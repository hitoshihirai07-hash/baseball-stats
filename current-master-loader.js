// current-master-loader.js
// 今年度ページ用の選手マスタCSVと2026オーダーCSVを読み込む
(function () {
    const PATH = 'data/current_player_master.csv';
    const LINEUP_PATH = '2026lineup.csv';

    window.CURRENT_PLAYER_MASTER = window.CURRENT_PLAYER_MASTER || [];
    window.CURRENT_LINEUP_2026 = window.CURRENT_LINEUP_2026 || [];

    const state = {
        loaded: false,
        promise: null,
        lineupLoaded: false,
        lineupPromise: null
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

    function parsePlayerMasterCSV(text) {
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

    function firstValue(row, keys) {
        for (const key of keys) {
            const value = row[key];
            if (value != null && String(value).trim()) return String(value).trim();
        }
        return '';
    }

    function parseLineupCSV(text) {
        const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        if (!lines.length) return [];
        const header = parseCSVLine(lines[0]);
        return lines.slice(1).map(line => {
            const cols = parseCSVLine(line);
            const row = {};
            header.forEach((key, idx) => row[key] = cols[idx] ?? '');
            return {
                gameId: firstValue(row, ['試合ID', 'game_id']),
                date: firstValue(row, ['試合日', 'game_date']),
                team: normalizeTeam(firstValue(row, ['チーム', 'team'])),
                slots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => firstValue(row, [String(n), `${n} `])),
                pitcher: firstValue(row, ['投手', '10', '10 '])
            };
        }).filter(row => row.team && row.date);
    }

    async function ensure() {
        if (state.loaded) return window.CURRENT_PLAYER_MASTER;
        if (state.promise) return state.promise;
        state.promise = fetch(PATH)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load ${PATH}`);
                return res.text();
            })
            .then(text => {
                window.CURRENT_PLAYER_MASTER = parsePlayerMasterCSV(text);
                state.loaded = true;
                return window.CURRENT_PLAYER_MASTER;
            })
            .catch(error => {
                state.promise = null;
                throw error;
            });
        return state.promise;
    }

    async function ensureLineup2026() {
        if (state.lineupLoaded) return window.CURRENT_LINEUP_2026;
        if (state.lineupPromise) return state.lineupPromise;
        state.lineupPromise = fetch(LINEUP_PATH)
            .then(res => {
                if (!res.ok) throw new Error(`Failed to load ${LINEUP_PATH}`);
                return res.text();
            })
            .then(text => {
                window.CURRENT_LINEUP_2026 = parseLineupCSV(text);
                state.lineupLoaded = true;
                return window.CURRENT_LINEUP_2026;
            })
            .catch(error => {
                state.lineupPromise = null;
                throw error;
            });
        return state.lineupPromise;
    }

    window.CurrentMasterStore = {
        ensure,
        ensureLineup2026,
        state
    };
})();
