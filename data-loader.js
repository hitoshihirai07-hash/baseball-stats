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
    ];

    let loaded = 0;
    const allBatRows = [];
    const allPitRows = [];

    function onAllLoaded() {
        // Batting
        const batYears = new Set(allBatRows.map(r => r[1]));
        const filteredBat = (window.BATTING_DATA || []).filter(r => !batYears.has(r[1]));
        window.BATTING_DATA = [...allBatRows, ...filteredBat];

        // Pitching
        const pitYears = new Set(allPitRows.map(r => r[1]));
        const filteredPit = (window.PITCHING_DATA || []).filter(r => !pitYears.has(r[1]));
        window.PITCHING_DATA = [...allPitRows, ...filteredPit];

        if (typeof initDropdowns === 'function') {
            ['by', 'bt', 'py', 'pt'].forEach(id => {
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
            window.bPage = 1;
            window.pPage = 1;
            if (typeof rb === 'function') rb();
            if (typeof rp === 'function') rp();
            if (typeof show === 'function') show('home');
        }
    }

    FILES.forEach(({ url, year, type }) => {
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            })
            .then(text => {
                if (type === 'bat') {
                    const rows = parseBattingData(text, year);
                    allBatRows.push(...rows);
                } else {
                    const rows = parsePitchingData(text, year);
                    allPitRows.push(...rows);
                }
            })
            .catch(e => { console.warn('Load failed:', url, e); })
            .finally(() => {
                loaded++;
                if (loaded === FILES.length) onAllLoaded();
            });
    });
})();
