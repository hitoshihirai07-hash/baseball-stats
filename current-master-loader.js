(function () {
    const PATH = 'data/current_player_master.csv';

    window.CURRENT_PLAYER_MASTER = window.CURRENT_PLAYER_MASTER || [];

    const state = {
        loaded: false,
        promise: null
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

    function parseCSV(text) {
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

    async function ensure() {
        if (state.loaded) return window.CURRENT_PLAYER_MASTER;
        if (state.promise) return state.promise;
        state.promise = fetch(PATH)
            .then(res => {
                if (!res.ok) throw new Error('今年度データの読込に失敗しました');
                return res.text();
            })
            .then(text => {
                window.CURRENT_PLAYER_MASTER = parseCSV(text);
                state.loaded = true;
                return window.CURRENT_PLAYER_MASTER;
            })
            .catch(error => {
                state.promise = null;
                throw error;
            });
        return state.promise;
    }

    window.CurrentMasterStore = {
        ensure,
        state
    };
})();
