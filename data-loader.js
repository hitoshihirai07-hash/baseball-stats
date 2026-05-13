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
        careerBatter: 'career_record_batter.csv',
        careerPitcher: 'career_record_pitcher.csv',
    };

    window.BATTING_DATA = window.BATTING_DATA || [];
    window.PITCHING_DATA = window.PITCHING_DATA || [];
    window.TEAM_DATA = window.TEAM_DATA || [];
    window.ORDER_DATA = window.ORDER_DATA || [];
    window.ORDER_TOP3 = window.ORDER_TOP3 || {};
    window.SITE_SUMMARY = window.SITE_SUMMARY || null;
    window.CAREER_BATTER_DATA = window.CAREER_BATTER_DATA || [];
    window.CAREER_PITCHER_DATA = window.CAREER_PITCHER_DATA || [];


    const NIPPON_SERIES_WINNERS = {
        2020: '福岡ソフトバンクホークス',
        2021: '東京ヤクルトスワローズ',
        2022: 'オリックスバファローズ',
        2023: '阪神タイガース',
        2024: '横浜DeNAベイスターズ',
        2025: '福岡ソフトバンクホークス',
    };


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

    function parseCSVLine(line) {
        const out = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                out.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur);
        return out.map(v => v.trim());
    }

    async function loadCSV(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load: ${url}`);
        const text = await response.text();
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (!lines.length) return [];
        const header = parseCSVLine(lines[0]);
        return lines.slice(1).map(line => {
            const cols = parseCSVLine(line);
            const row = {};
            header.forEach((key, idx) => row[key] = cols[idx] ?? '');
            return row;
        });
    }

    function toNumber(value) {
        if (value === null || value === undefined || value === '') return 0;
        const n = Number(String(value).replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }

    function parseCareerBatterRows(rows) {
        return rows.map(row => ({
            team: row['所属正式名'] || '',
            name: row['選手名'] || '',
            position: row['主ポジション'] || '',
            games: toNumber(row['試合']),
            pa: toNumber(row['打席']),
            ab: toNumber(row['打数']),
            avg: toNumber(row['打率']),
            runs: toNumber(row['得点']),
            rbi: toNumber(row['打点']),
            hits: toNumber(row['安打']),
            doubles: toNumber(row['二塁打']),
            triples: toNumber(row['三塁打']),
            homeRuns: toNumber(row['本塁打']),
            steals: toNumber(row['盗塁']),
            walks: toNumber(row['四球']),
            strikeouts: toNumber(row['三振']),
            sacrifices: toNumber(row['犠打']),
            sacFlies: toNumber(row['犠飛']),
            obp: toNumber(row['出塁率']),
            slg: toNumber(row['長打率']),
            ops: toNumber(row['OPS'])
        })).filter(row => row.name);
    }

    function parseCareerPitcherRows(rows) {
        return rows.map(row => ({
            team: row['所属正式名'] || '',
            name: row['選手名'] || '',
            position: row['主ポジション'] || '',
            games: toNumber(row['登板']),
            starts: toNumber(row['先発']),
            completeGames: toNumber(row['完投']),
            shutouts: toNumber(row['完封勝']),
            noWalk: toNumber(row['無四球']),
            wins: toNumber(row['勝利']),
            losses: toNumber(row['敗北']),
            saves: toNumber(row['セーブ']),
            holds: toNumber(row['ホールド']),
            hp: toNumber(row['HP']),
            innings: toNumber(row['投球回']),
            era: toNumber(row['防御率']),
            whip: toNumber(row['WHIP']),
            winPct: toNumber(row['勝率']),
            battersFaced: toNumber(row['打者']),
            hitsAllowed: toNumber(row['安打']),
            avgAllowed: toNumber(row['被打率']),
            runs: toNumber(row['失点']),
            earnedRuns: toNumber(row['自責点']),
            homeRunsAllowed: toNumber(row['被本塁打']),
            strikeouts: toNumber(row['奪三振']),
            walks: toNumber(row['与四球'])
        })).filter(row => row.name);
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

    function normalizeTeamRows(rows) {
        if (!Array.isArray(rows)) return [];
        const hasExplicitChampion = rows.some(row => row && row.nippon === '○');
        return rows.map(row => {
            if (!row || typeof row !== 'object') return row;
            if (hasExplicitChampion) return row;
            const championTeam = NIPPON_SERIES_WINNERS[Number(row.year)];
            return {
                ...row,
                nippon: championTeam && row.team === championTeam ? '○' : (row.nippon || '-')
            };
        });
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


    async function ensureCareerBatter() {
        if (state.loaded.careerBatter) return window.CAREER_BATTER_DATA;
        return once('careerBatter', async () => {
            const rows = await loadCSV(PATHS.careerBatter);
            window.CAREER_BATTER_DATA = parseCareerBatterRows(rows);
            state.loaded.careerBatter = true;
            return window.CAREER_BATTER_DATA;
        });
    }

    async function ensureCareerPitching() {
        if (state.loaded.careerPitching) return window.CAREER_PITCHER_DATA;
        return once('careerPitching', async () => {
            const rows = await loadCSV(PATHS.careerPitcher);
            window.CAREER_PITCHER_DATA = parseCareerPitcherRows(rows);
            state.loaded.careerPitching = true;
            return window.CAREER_PITCHER_DATA;
        });
    }

    async function ensureTeam() {
        if (state.loaded.team) return window.TEAM_DATA;
        return once('team', async () => {
            const payload = await loadJSON(PATHS.team);
            window.TEAM_DATA = normalizeTeamRows(payload.rows || []);
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
        if (section === 'batting') { await Promise.all([ensureBatting(), ensureCareerBatter()]); return true; }
        if (section === 'pitching') { await Promise.all([ensurePitching(), ensureCareerPitching()]); return true; }
        if (section === 'team') { await ensureTeam(); return true; }
        if (section === 'simulator') { await Promise.all([ensureBatting(), ensurePitching()]); return true; }
        if (section === 'myorder') { await Promise.all([ensureBatting(), ensurePitching(), ensureTeam()]); return true; }
        if (section === 'records') { await Promise.all([ensureBatting(), ensurePitching(), ensureTeam(), ensureCareerBatter(), ensureCareerPitching()]); return true; }
        if (section === 'pro-report') { await Promise.all([ensureBatting(), ensurePitching(), ensureTeam()]); return true; }
        if (section === 'order') { await ensureOrderTop3(); return true; }
        return true;
    }

    window.NIPPON_SERIES_WINNERS = NIPPON_SERIES_WINNERS;
    window.DataStore = { YEARS, ensureSummary, ensureBatting, ensurePitching, ensureCareerBatter, ensureCareerPitching, ensureTeam, ensureOrderTop3, ensureOrderYear, ensureAllOrders, ensureSectionData, state };
    ensureSummary().catch(error => console.warn('summary load failed', error));
})();
