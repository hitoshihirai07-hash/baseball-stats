(function () {
    const BATTER_PATH = '2026stats_batter.csv';
    const PITCHER_PATH = '2026stats_pitcher.csv';
    const BATTER_LR_PATH = '2026_batter_left_and_right_stats.csv';

    window.CURRENT_SEASON_BATTER_STATS = window.CURRENT_SEASON_BATTER_STATS || [];
    window.CURRENT_SEASON_PITCHER_STATS = window.CURRENT_SEASON_PITCHER_STATS || [];
    window.CURRENT_SEASON_BATTER_LR_STATS = window.CURRENT_SEASON_BATTER_LR_STATS || [];

    const state = {
        loaded: false,
        promise: null
    };

    function normalizeTeam(team) {
        const raw = String(team || '').trim();
        const map = {
            '巨人': '読売ジャイアンツ',
            '阪神': '阪神タイガース',
            'DeNA': '横浜DeNAベイスターズ',
            '横浜DeNA': '横浜DeNAベイスターズ',
            '広島': '広島東洋カープ',
            '中日': '中日ドラゴンズ',
            'ヤクルト': '東京ヤクルトスワローズ',
            'ソフトバンク': '福岡ソフトバンクホークス',
            '西武': '埼玉西武ライオンズ',
            '楽天': '東北楽天ゴールデンイーグルス',
            'ロッテ': '千葉ロッテマリーンズ',
            '日本ハム': '北海道日本ハムファイターズ',
            '日ハム': '北海道日本ハムファイターズ',
            'オリックス': 'オリックス・バファローズ',
            'オリックス・バファローズ': 'オリックス・バファローズ'
        };
        return map[raw] || raw;
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
            row.rawTeam = String(row['チーム'] || row['球団'] || '').trim();
            row.team = normalizeTeam(row.rawTeam);
            return row;
        }).filter(row => row['選手名']);
    }

    async function ensure() {
        if (state.loaded) return {
            batters: window.CURRENT_SEASON_BATTER_STATS,
            pitchers: window.CURRENT_SEASON_PITCHER_STATS,
            batterLr: window.CURRENT_SEASON_BATTER_LR_STATS
        };
        if (state.promise) return state.promise;
        state.promise = Promise.all([
            fetch(BATTER_PATH).then(res => {
                if (!res.ok) throw new Error('今年度データの読込に失敗しました');
                return res.text();
            }),
            fetch(PITCHER_PATH).then(res => {
                if (!res.ok) throw new Error('今年度データの読込に失敗しました');
                return res.text();
            }),
            fetch(BATTER_LR_PATH).then(res => {
                if (!res.ok) throw new Error('今年度データの読込に失敗しました');
                return res.text();
            })
        ]).then(([batterText, pitcherText, batterLrText]) => {
            window.CURRENT_SEASON_BATTER_STATS = parseCSV(batterText);
            window.CURRENT_SEASON_PITCHER_STATS = parseCSV(pitcherText);
            window.CURRENT_SEASON_BATTER_LR_STATS = parseCSV(batterLrText).map(row => ({
                ...row,
                sortType: String(row['区分'] || '') === '対右' ? 0 : String(row['区分'] || '') === '対左' ? 1 : 9
            }));
            state.loaded = true;
            return {
                batters: window.CURRENT_SEASON_BATTER_STATS,
                pitchers: window.CURRENT_SEASON_PITCHER_STATS,
                batterLr: window.CURRENT_SEASON_BATTER_LR_STATS
            };
        }).catch(error => {
            state.promise = null;
            throw error;
        });
        return state.promise;
    }

    window.CurrentSeasonStatsStore = {
        ensure,
        state,
        normalizeTeam
    };
})();
