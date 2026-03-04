// data-loader.js
// データベースフォルダから各年度の統計データを自動的に読み込みます

(function () {
    const TEAM_MAP = {
        '巨人': '読売ジャイアンツ',
        '阪神': '阪神タイガース',
        'DeNA': '横浜DeNAベイスターズ',
        '広島': '広島東洋カープ',
        'ヤクルト': '東京ヤクルトスワローズ',
        '中日': '中日ドラゴンズ',
        'ソフトバンク': '福岡ソフトバンクホークス',
        '日本ハム': '北海道日本ハムファイターズ',
        'オリックス': 'オリックス・バファローズ',
        '楽天': '東北楽天ゴールデンイーグルス',
        '西武': '埼玉西武ライオンズ',
        'ロッテ': '千葉ロッテマリーンズ',
    };

    function parseBattingData(text, year) {
        const lines = text.trim().split('\n');
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 13) continue;
            const name = cols[0];
            const yr = parseInt(cols[1]) || year;
            const team = TEAM_MAP[cols[2]] || cols[2];
            const games = parseInt(cols[3]) || 0;
            const avg = parseFloat(cols[4]) || 0;
            const hits = parseInt(cols[5]) || 0;
            const hr = parseInt(cols[6]) || 0;
            const rbi = parseInt(cols[7]) || 0;
            const sb = parseInt(cols[8]) || 0;
            const obp = parseFloat(cols[9]) || 0;
            const slg = parseFloat(cols[10]) || 0;
            const ops = parseFloat(cols[11]) || 0;
            const pa = parseInt(cols[12]) || 0;
            rows.push([name, yr, team, games, avg, hr, rbi, hits, sb, ops, obp, slg, pa]);
        }
        return rows;
    }

    function parsePitchingData(text, year) {
        const lines = text.trim().split('\n');
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 12) continue;
            // 選手,年度,球団,試合,勝利,敗戦,セーブ,ＨＰ,奪三振,勝率,投球回,防御率
            const name = cols[0];
            const yr = parseInt(cols[1]) || year;
            const team = TEAM_MAP[cols[2]] || cols[2];
            const games = parseInt(cols[3]) || 0;
            const win = parseInt(cols[4]) || 0;
            const loss = parseInt(cols[5]) || 0;
            const save = parseInt(cols[6]) || 0;
            const hp = parseInt(cols[7]) || 0;
            const k = parseInt(cols[8]) || 0;
            const pct = parseFloat(cols[9]) || 0;
            const ipRaw = cols[10];
            const era = parseFloat(cols[11]) || 0;

            // 投球回を数値に変換 (例: 156.1 -> 156.333)
            let ipNum = 0;
            if (ipRaw && ipRaw.includes('.')) {
                const parts = ipRaw.split('.');
                ipNum = parseInt(parts[0]) + (parseInt(parts[1]) / 3);
            } else {
                ipNum = parseFloat(ipRaw) || 0;
            }

            rows.push([name, yr, team, games, win, loss, save, era, k, pct, ipRaw, ipNum, hp]);
        }
        return rows;
    }

    function parseTeamData(text, year, league) {
        // Robust CSV parsing for multi-line cells
        const rows = [];
        let curr = [];
        let field = "";
        let inQuote = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                curr.push(field.trim());
                field = "";
            } else if (char === '\n' && !inQuote) {
                curr.push(field.trim());
                if (curr.length > 5 && curr[0] !== 'チーム') {
                    // チーム,試合,勝利,敗北,引分,勝率,差,...
                    rows.push({
                        team: curr[0],
                        year: year,
                        league: league,
                        w: parseInt(curr[2]) || 0,
                        l: parseInt(curr[3]) || 0,
                        t: parseInt(curr[4]) || 0,
                        pct: parseFloat(curr[5]) || 0,
                        rank: 0, // Will be calculated after sorting by pct
                        nippon: '×' // Placeholder
                    });
                }
                curr = [];
                field = "";
            } else {
                field += char;
            }
        }
        return rows;
    }

    const FILES = [
        { url: 'data/2020batter.csv', year: 2020, type: 'bat' },
        { url: 'data/2021batter.csv', year: 2021, type: 'bat' },
        { url: 'data/2022batter.csv', year: 2022, type: 'bat' },
        { url: 'data/2023batter.csv', year: 2023, type: 'bat' },
        { url: 'data/2024batter.csv', year: 2024, type: 'bat' },
        { url: 'data/2025batter.csv', year: 2025, type: 'bat' },
        { url: 'data/2020pitther.csv', year: 2020, type: 'pit' },
        { url: 'data/2021pitther.csv', year: 2021, type: 'pit' },
        { url: 'data/2022pitther.csv', year: 2022, type: 'pit' },
        { url: 'data/2023pitther.csv', year: 2023, type: 'pit' },
        { url: 'data/2024pitther.csv', year: 2024, type: 'pit' },
        { url: 'data/2025pitther.csv', year: 2025, type: 'pit' },
        // Team Data (data2/)
        { url: 'data2/2020se.csv', year: 2020, type: 'team', league: 'セ' },
        { url: 'data2/2020pa.csv', year: 2020, type: 'team', league: 'パ' },
        { url: 'data2/2021se.csv', year: 2021, type: 'team', league: 'セ' },
        { url: 'data2/2021pa.csv', year: 2021, type: 'team', league: 'パ' },
        { url: 'data2/2022se.csv', year: 2022, type: 'team', league: 'セ' },
        { url: 'data2/2022pa.csv', year: 2022, type: 'team', league: 'パ' },
        { url: 'data2/2023se.csv', year: 2023, type: 'team', league: 'セ' },
        { url: 'data2/2023pa.csv', year: 2023, type: 'team', league: 'パ' },
        { url: 'data2/2024se.csv', year: 2024, type: 'team', league: 'セ' },
        { url: 'data2/2024pa.csv', year: 2024, type: 'team', league: 'パ' },
        { url: 'data2/2025se.csv', year: 2025, type: 'team', league: 'セ' },
        { url: 'data2/2025pa.csv', year: 2025, type: 'team', league: 'パ' },
    ];

    let loaded = 0;
    const allBatRows = [];
    const allPitRows = [];
    const allTeamRows = [];

    function onAllLoaded() {
        // Batting
        const batYears = new Set(allBatRows.map(r => r[1]));
        const filteredBat = (window.BATTING_DATA || []).filter(r => !batYears.has(r[1]));
        window.BATTING_DATA = [...allBatRows, ...filteredBat];

        // Pitching
        const pitYears = new Set(allPitRows.map(r => r[1]));
        const filteredPit = (window.PITCHING_DATA || []).filter(r => !pitYears.has(r[1]));
        window.PITCHING_DATA = [...allPitRows, ...filteredPit];

        // Team
        // Sort each year/league by pct and assign rank
        const years = [...new Set(allTeamRows.map(r => r.year))];
        years.forEach(y => {
            ['セ', 'パ'].forEach(l => {
                const subset = allTeamRows.filter(r => r.year === y && r.league === l)
                    .sort((a, b) => b.pct - a.pct);
                subset.forEach((r, idx) => { r.rank = idx + 1; });
            });
        });
        window.TEAM_DATA = allTeamRows;

        if (typeof initDropdowns === 'function') {
            ['by', 'bt', 'py', 'pt', 'ty', 'tt'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const first = el.options[0];
                    el.innerHTML = '';
                    el.appendChild(first);
                }
            });
            initDropdowns();
            window.bF = [...window.BATTING_DATA];
            window.pF = [...window.PITCHING_DATA];
            window.tF = [...window.TEAM_DATA];
            window.bPage = 1;
            window.pPage = 1;
            window.tPage = 1;
            if (typeof rb === 'function') rb();
            if (typeof rp === 'function') rp();
            if (typeof rt === 'function') rt();
            if (typeof show === 'function') show('home');
        }
    }

    FILES.forEach(({ url, year, type, league }) => {
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            })
            .then(text => {
                if (type === 'bat') {
                    const rows = parseBattingData(text, year);
                    allBatRows.push(...rows);
                } else if (type === 'pit') {
                    const rows = parsePitchingData(text, year);
                    allPitRows.push(...rows);
                } else if (type === 'team') {
                    const rows = parseTeamData(text, year, league);
                    allTeamRows.push(...rows);
                }
            })
            .catch(e => { console.warn('Load failed:', url, e); })
            .finally(() => {
                loaded++;
                if (loaded === FILES.length) onAllLoaded();
            });
    });
})();
