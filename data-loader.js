// data-loader.js
// 公開側では JSON を必要な分だけ読み込み、初回表示を軽くします。

(function () {
    const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
    const PATHS = {
        summary: 'public-data/summary.json',
        batting: 'public-data/batting/all.json',
        pitching: 'public-data/pitching/all.json',
        team: 'public-data/team/all.json',
        orderTop3: 'public-data/order/top3.json',
        orderYear: year => `public-data/order/by-year/${year}.json`,
    };

    window.BATTING_DATA = window.BATTING_DATA || [];
    window.PITCHING_DATA = window.PITCHING_DATA || [];
    window.TEAM_DATA = window.TEAM_DATA || [];
    window.ORDER_DATA = window.ORDER_DATA || [];
    window.ORDER_TOP3 = window.ORDER_TOP3 || {};
    window.SITE_SUMMARY = window.SITE_SUMMARY || null;

    const state = {
        loaded: { summary: false, batting: false, pitching: false, team: false, orderTop3: false },
        orderYears: new Set(),
        promises: {},
    };

    function once(key, task) {
        if (state.promises[key]) return state.promises[key];
        state.promises[key] = (async () => {
            try {
                return await task();
            } catch (error) {
                delete state.promises[key];
                throw error;
            }
        })();
        return state.promises[key];
    }

    async function loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load: ${url}`);
        return await response.json();
    }

    function sortOrderRows() {
        window.ORDER_DATA.sort((a, b) => {
            if (a[0] !== b[0]) return a[0] - b[0];
            if (a[1] !== b[1]) return String(a[1]).localeCompare(String(b[1]));
            return String(a[2]).localeCompare(String(b[2]));
        });
    }

    function syncHomeCounts() {
        if (typeof window.updateHomeCounts === 'function') window.updateHomeCounts();
    }

    async function ensureSummary() {
        if (state.loaded.summary) return window.SITE_SUMMARY;
        return once('summary', async () => {
            window.SITE_SUMMARY = await loadJSON(PATHS.summary);
            state.loaded.summary = true;
            syncHomeCounts();
            return window.SITE_SUMMARY;
        });
    }

    async function ensureBatting() {
        if (state.loaded.batting) return window.BATTING_DATA;
        return once('batting', async () => {
            const payload = await loadJSON(PATHS.batting);
            window.BATTING_DATA = payload.rows || [];
            state.loaded.batting = true;
            syncHomeCounts();
            return window.BATTING_DATA;
        });
    }

    async function ensurePitching() {
        if (state.loaded.pitching) return window.PITCHING_DATA;
        return once('pitching', async () => {
            const payload = await loadJSON(PATHS.pitching);
            window.PITCHING_DATA = payload.rows || [];
            state.loaded.pitching = true;
            syncHomeCounts();
            return window.PITCHING_DATA;
        });
    }

    async function ensureTeam() {
        if (state.loaded.team) return window.TEAM_DATA;
        return once('team', async () => {
            const payload = await loadJSON(PATHS.team);
            window.TEAM_DATA = payload.rows || [];
            state.loaded.team = true;
            return window.TEAM_DATA;
        });
    }

    async function ensureOrderTop3() {
        if (state.loaded.orderTop3) return window.ORDER_TOP3;
        return once('orderTop3', async () => {
            window.ORDER_TOP3 = await loadJSON(PATHS.orderTop3);
            state.loaded.orderTop3 = true;
            return window.ORDER_TOP3;
        });
    }

    async function ensureOrderYear(year) {
        const numericYear = Number(year);
        if (!numericYear) return window.ORDER_DATA;
        if (state.orderYears.has(numericYear)) return window.ORDER_DATA;
        return once(`order-${numericYear}`, async () => {
            const payload = await loadJSON(PATHS.orderYear(numericYear));
            const rows = payload.rows || [];
            window.ORDER_DATA.push(...rows);
            state.orderYears.add(numericYear);
            sortOrderRows();
            syncHomeCounts();
            return window.ORDER_DATA;
        });
    }

    async function ensureAllOrders() {
        await Promise.all(YEARS.map(year => ensureOrderYear(year)));
        return window.ORDER_DATA;
    }

    async function ensureSectionData(section) {
        await ensureSummary();
        if (section === 'home') return true;
        if (section === 'batting') { await ensureBatting(); return true; }
        if (section === 'pitching') { await ensurePitching(); return true; }
        if (section === 'team') { await ensureTeam(); return true; }
        if (section === 'simulator') { await Promise.all([ensureBatting(), ensurePitching()]); return true; }
        if (section === 'myorder') { await Promise.all([ensureBatting(), ensurePitching(), ensureTeam()]); return true; }
        if (section === 'records' || section === 'pro-report') { await Promise.all([ensureBatting(), ensurePitching(), ensureTeam()]); return true; }
        if (section === 'order') { await ensureOrderTop3(); return true; }
        return true;
    }

    window.DataStore = { YEARS, ensureSummary, ensureBatting, ensurePitching, ensureTeam, ensureOrderTop3, ensureOrderYear, ensureAllOrders, ensureSectionData, state };
    ensureSummary().catch(error => console.warn('summary load failed', error));
})();
