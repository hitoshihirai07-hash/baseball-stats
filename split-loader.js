// split-loader.js
// data/batting_vs_lr.csv と data/pitching_vs_lr.csv を読み込み、左右別成績を保持する。

(function () {
    const TEAM_MAP = {
        '巨人': '読売ジャイアンツ',
        '読売ジャイアンツ': '読売ジャイアンツ',
        '阪神': '阪神タイガース',
        '阪神タイガース': '阪神タイガース',
        'DeNA': '横浜DeNAベイスターズ',
        '横浜DeNAベイスターズ': '横浜DeNAベイスターズ',
        '広島': '広島東洋カープ',
        '広島東洋カープ': '広島東洋カープ',
        'ヤクルト': '東京ヤクルトスワローズ',
        '東京ヤクルトスワローズ': '東京ヤクルトスワローズ',
        '中日': '中日ドラゴンズ',
        '中日ドラゴンズ': '中日ドラゴンズ',
        'ソフトバンク': '福岡ソフトバンクホークス',
        '福岡ソフトバンクホークス': '福岡ソフトバンクホークス',
        '西武': '埼玉西武ライオンズ',
        '埼玉西武ライオンズ': '埼玉西武ライオンズ',
        '楽天': '東北楽天ゴールデンイーグルス',
        '東北楽天ゴールデンイーグルス': '東北楽天ゴールデンイーグルス',
        'ロッテ': '千葉ロッテマリーンズ',
        '千葉ロッテマリーンズ': '千葉ロッテマリーンズ',
        '日本ハム': '北海道日本ハムファイターズ',
        '北海道日本ハムファイターズ': '北海道日本ハムファイターズ',
        'オリックス': 'オリックスバファローズ',
        'オリックスバファローズ': 'オリックスバファローズ'
    };

    const PATHS = {
        batting: 'data/batting_vs_lr.csv',
        pitching: 'data/pitching_vs_lr.csv'
    };

    window.BATTING_SPLIT_DATA = window.BATTING_SPLIT_DATA || [];
    window.PITCHING_SPLIT_DATA = window.PITCHING_SPLIT_DATA || [];

    const state = {
        loaded: { batting: false, pitching: false },
        promises: {}
    };

    function normalizeTeam(team) {
        if (!team) return team;
        return TEAM_MAP[String(team).trim()] || String(team).trim();
    }

    function toNumber(value) {
        if (value == null) return null;
        const cleaned = String(value).trim().replace(/,/g, '');
        if (!cleaned) return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }

    function calcRate(hits, atBats) {
        if (hits == null || atBats == null || Number(atBats) <= 0) return null;
        return Number(hits) / Number(atBats);
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
            return row;
        });
    }

    async function loadCSV(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load ${url}`);
        return await res.text();
    }

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

    async function ensureBattingSplit() {
        if (state.loaded.batting) return window.BATTING_SPLIT_DATA;
        return once('batting-split', async () => {
            const text = await loadCSV(PATHS.batting);
            const rows = parseCSV(text).map(row => {
                const leftHits = toNumber(row['対左安打数']);
                const leftAb = toNumber(row['対左打数']);
                const rightHits = toNumber(row['対右安打数']);
                const rightAb = toNumber(row['対右打数']);
                const leftAvg = calcRate(leftHits, leftAb);
                const rightAvg = calcRate(rightHits, rightAb);
                return {
                    name: row['選手名'],
                    team: normalizeTeam(row['球団']),
                    year: toNumber(row['年度']),
                    position: row['ポジション'] || '',
                    leftPaAb: toNumber(row['対左打席数または打数']),
                    leftHits,
                    leftAb,
                    leftAvg,
                    rightPaAb: toNumber(row['対右打席数または打数']),
                    rightHits,
                    rightAb,
                    rightAvg,
                    diffAvg: leftAvg != null && rightAvg != null ? leftAvg - rightAvg : null
                };
            }).filter(row => row.name && row.team && row.year);
            window.BATTING_SPLIT_DATA = rows;
            state.loaded.batting = true;
            return rows;
        });
    }

    async function ensurePitchingSplit() {
        if (state.loaded.pitching) return window.PITCHING_SPLIT_DATA;
        return once('pitching-split', async () => {
            const text = await loadCSV(PATHS.pitching);
            const rows = parseCSV(text).map(row => {
                const leftHits = toNumber(row['対左被安打']);
                const leftAb = toNumber(row['対被左打数']);
                const rightHits = toNumber(row['対右被安打']);
                const rightAb = toNumber(row['対被右打数']);
                const leftAvg = calcRate(leftHits, leftAb);
                const rightAvg = calcRate(rightHits, rightAb);
                return {
                    name: row['選手名'],
                    team: normalizeTeam(row['球団']),
                    year: toNumber(row['年度']),
                    position: row['ポジション'] || '',
                    leftAb,
                    leftHits,
                    leftAvg,
                    rightAb,
                    rightHits,
                    rightAvg,
                    diffAvg: leftAvg != null && rightAvg != null ? leftAvg - rightAvg : null
                };
            }).filter(row => row.name && row.team && row.year);
            window.PITCHING_SPLIT_DATA = rows;
            state.loaded.pitching = true;
            return rows;
        });
    }

    window.SplitDataStore = {
        ensureBattingSplit,
        ensurePitchingSplit,
        state
    };
})();
