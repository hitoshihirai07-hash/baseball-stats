// current-master-loader.js
// 今年度ページ用の選手マスタCSVと今年度オーダーCSVを読み込む
(function () {
    const PLAYER_PATH = 'data/current_player_master.csv';
    const ORDER_PATH = '2026lineup.csv';

    window.CURRENT_PLAYER_MASTER = window.CURRENT_PLAYER_MASTER || [];
    window.CURRENT_ORDER_2026 = window.CURRENT_ORDER_2026 || [];

    const state = {
        loaded: false,
        promise: null,
        currentOrderLoaded: false,
        currentOrderPromise: null
    };

    function normalizeTeam(team) {
        const raw = String(team || '').trim();
        if (!raw) return '';
        if (raw === 'オリックス・バファローズ') return 'オリックスバファローズ';
        return raw;
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

    function normalizeHeaderKey(value) {
        return String(value || '').replace(/[\s\u3000]+/g, '').trim();
    }

    function parsePlayerCSV(text) {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (!lines.length) return [];
        const header = parseCSVLine(lines[0]);
        return lines.slice(1).map(line => {
            const cols = parseCSVLine(line);
            const row = {};
            header.forEach((key, idx) => row[key] = cols[idx] ?? '');
            return {
                team: normalizeTeam(row['球団名']),
                no: String(row['No.'] || '').trim(),
                name: String(row['投手'] || row['選手名'] || '').trim(),
                birthDate: String(row['生年月日'] || '').trim(),
                height: String(row['身長'] || '').trim(),
                weight: String(row['体重'] || '').trim(),
                throwHand: String(row['投'] || '').trim(),
                batHand: String(row['打'] || '').trim(),
                note: String(row['備考'] || '').trim(),
                position: String(row['ポジション'] || '').trim(),
                division: String(row['区分'] || '').trim(),
                updatedAt: String(row['更新日'] || '').trim()
            };
        }).filter(row => row.name && row.team);
    }

    function parseCurrentOrderCSV(text) {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (!lines.length) return [];
        const header = parseCSVLine(lines[0]).map(normalizeHeaderKey);
        return lines.slice(1).map(line => {
            const cols = parseCSVLine(line);
            const row = {};
            header.forEach((key, idx) => row[key] = cols[idx] ?? '');
            const ninth = String(row['9'] || '').trim();
            return {
                gameId: String(row['試合ID'] || '').trim(),
                date: String(row['試合日'] || '').trim(),
                team: normalizeTeam(row['チーム']),
                slot1: String(row['1'] || '').trim(),
                slot2: String(row['2'] || '').trim(),
                slot3: String(row['3'] || '').trim(),
                slot4: String(row['4'] || '').trim(),
                slot5: String(row['5'] || '').trim(),
                slot6: String(row['6'] || '').trim(),
                slot7: String(row['7'] || '').trim(),
                slot8: String(row['8'] || '').trim(),
                slot9: ninth,
                pitcher: String(row['10'] || ninth || '').trim()
            };
        }).filter(row => row.team && row.date);
    }

    async function ensurePlayers() {
        if (state.loaded) return window.CURRENT_PLAYER_MASTER;
        if (state.promise) return state.promise;
        state.promise = fetch(PLAYER_PATH)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load ${PLAYER_PATH}`);
                return res.text();
            })
            .then(text => {
                window.CURRENT_PLAYER_MASTER = parsePlayerCSV(text);
                state.loaded = true;
                return window.CURRENT_PLAYER_MASTER;
            })
            .catch(error => {
                state.promise = null;
                throw error;
            });
        return state.promise;
    }

    async function ensureCurrentOrder() {
        if (state.currentOrderLoaded) return window.CURRENT_ORDER_2026;
        if (state.currentOrderPromise) return state.currentOrderPromise;
        state.currentOrderPromise = fetch(ORDER_PATH)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load ${ORDER_PATH}`);
                return res.text();
            })
            .then(text => {
                window.CURRENT_ORDER_2026 = parseCurrentOrderCSV(text);
                state.currentOrderLoaded = true;
                return window.CURRENT_ORDER_2026;
            })
            .catch(error => {
                state.currentOrderPromise = null;
                throw error;
            });
        return state.currentOrderPromise;
    }

    async function ensure() {
        await Promise.all([ensurePlayers(), ensureCurrentOrder()]);
        return window.CURRENT_PLAYER_MASTER;
    }

    window.CurrentMasterStore = {
        ensure,
        ensurePlayers,
        ensureCurrentOrder,
        state
    };
})();
