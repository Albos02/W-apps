document.addEventListener('DOMContentLoaded', () => {
    console.log('ui-manager.js DOMContentLoaded');
    
    function init() {
        console.log('init running');
        const { METRIC_CONFIG, GROUPS, METRIC_TO_GROUP } = window.WindDashboard;
        if (!METRIC_CONFIG || !GROUPS) {
            console.error('METRIC_CONFIG or GROUPS not found in WindDashboard');
            return;
        }
        
        const metricsContainer = document.querySelector('.metrics .spotlight-container');
        const tableHead = document.querySelector('table thead');

        const ID_TO_KEY = {
            'wind-avg': 'windAvg',
            'wind-gusts': 'windGusts',
            'wind-direction': 'windDirection',
            'temperature': 'temperature',
            'humidity': 'humidity',
            'pressure': 'pressure',
            'pressure-qff': 'pressureQff',
            'pressure-qnh': 'pressureQnh',
            'precipitation': 'precipitation',
            'sunshine': 'sunshine',
            'global-radiation': 'globalRadiation',
            'dew-point': 'dewPoint'
        };

        function initNavigation() {
            const brand = document.querySelector('.brand');
            if (brand) brand.addEventListener('click', () => window.location.href = '../');
            
            const outlineBtn = document.querySelector('.actions .button.outline');
            if (outlineBtn) outlineBtn.addEventListener('click', () => window.location.href = '../');
            
            const primaryBtn = document.querySelector('.actions .button.primary');
            if (primaryBtn) primaryBtn.addEventListener('click', () => window.location.href = '../');
        }

        function initTheme() {
            const themeToggle = document.getElementById('theme-toggle');
            console.log('initTheme called, themeToggle:', themeToggle);
            if (!themeToggle) {
                console.warn('theme-toggle not found');
                return;
            }
            
            const savedTheme = localStorage.getItem('theme') || 'light';
            console.log('savedTheme:', savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

            function toggleTheme() {
                const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                document.body.classList.toggle('dark-mode', newTheme === 'dark');
                localStorage.setItem('theme', newTheme);
                themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
                console.log('theme toggled, current:', newTheme);
            }

            themeToggle.addEventListener('click', toggleTheme);
        }

        const activeGroup = localStorage.getItem('currentMetricGroup') || 'wind';
        const renderTableHeaders = (group) => {
            const params = GROUPS[group] || [];
            tableHead.innerHTML = `
                <tr>
                    <th>Time</th>
                    ${params.map(p => `<th>${METRIC_CONFIG[p].label}</th>`).join('')}
                </tr>
            `;
        };
        renderTableHeaders(activeGroup);

        metricsContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.metric');
            if (!card) return;
            
            const metricId = card.dataset.metricId;
            const metricKey = ID_TO_KEY[metricId];
            const group = metricKey ? METRIC_TO_GROUP[metricKey] : null;
            
            if (group) {
                localStorage.setItem('currentMetricGroup', group);
                renderTableHeaders(group);
                
                document.querySelectorAll('.metric').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                if (window.updateVisualizations) window.updateVisualizations();
            }
        });

        metricsContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.target.click();
            }
        });

        initNavigation();
        initTheme();

        console.log('UI initialized from METRIC_CONFIG', 'theme:', localStorage.getItem('theme'));
    }
    
    if (window.WindDashboard) {
        init();
    } else {
        console.log('waiting for WindDashboard...');
        setTimeout(init, 50);
    }
});