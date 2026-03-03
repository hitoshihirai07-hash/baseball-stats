// csv-loader.js
// data/ フォルダの 2020~2025batter.csv を自動読み込みして
// BATTING_DATA (グローバル) にマージする

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

    function parseCSV(text, year) {
        const lines = text.trim().split('\n');
        const rows = [];
        // 1行目はヘッダーなのでスキップ
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length < 12) continue;
            // カラム: 選手,年度,球団,試合,打率,安打,本塁打,打点,盗塁,出塁率,長打率,OPS
            const name = cols[0];
            const yr = parseInt(cols[1]) || year;
            const team = TEAM_MAP[cols[2]] || cols[2];
            const games = parseInt(cols[3]) || 0;
            const avg = parseFloat(cols[4]) || 0;
            const hits = parseInt(cols[5]) || 0;
            const hr = parseInt(cols[6]) || 0;
            const rbi = parseInt(cols[7]) || 0;
            const sb = parseInt(cols[8]) || 0;
            const ops = parseFloat(cols[11]) || 0;
            rows.push([name, yr, team, games, avg, hr, rbi, hits, sb, ops]);
        }
        return rows;
    }

    const FILES = [
        { url: 'data/2020batter.csv', year: 2020 },
        { url: 'data/2021batter.csv', year: 2021 },
        { url: 'data/2022batter.csv', year: 2022 },
        { url: 'data/2023batter.csv', year: 2023 },
        { url: 'data/2024batter.csv', year: 2024 },
        { url: 'data/2025batter.csv', year: 2025 },
    ];

    let loaded = 0;
    const allRows = [];

    function onAllLoaded() {
        // 既存データ(2010-2019のサンプル)からCSVと重複する年度を削除し、CSVを優先
        const csvYears = new Set(allRows.map(r => r[1]));
        const filtered = (window.BATTING_DATA || []).filter(r => !csvYears.has(r[1]));
        window.BATTING_DATA = [...allRows, ...filtered];

        // UIに反映
        if (typeof initDropdowns === 'function') {
            // 年度・チームドロップダウンを再構築
            ['by', 'bt'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const first = el.options[0];
                    el.innerHTML = '';
                    el.appendChild(first);
                }
            });
            initDropdowns();
            // 打撃テーブルを再描画
            window.bF = [...window.BATTING_DATA];
            window.bPage = 1;
            if (typeof rb === 'function') rb();
        }
        document.getElementById('cnt-bat').textContent = window.BATTING_DATA.length + '件';
        console.log('CSV読み込み完了:', window.BATTING_DATA.length + '件');
    }

    FILES.forEach(({ url, year }) => {
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.text();
            })
            .then(text => {
                const rows = parseCSV(text, year);
                allRows.push(...rows);
            })
            .catch(e => console.warn('CSV読み込み失敗:', url, e))
            .finally(() => {
                loaded++;
                if (loaded === FILES.length) onAllLoaded();
            });
    });
})();
