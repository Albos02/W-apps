import { METRIC_CONFIG, GROUPS, METRIC_TO_GROUP, METRIC_ID_TO_KEY } from './chart-utils.js';

let onMetricChangeCallback = null;

export function onMetricChange(callback) {
    onMetricChangeCallback = callback;
}

export function initUI() {
    if (!METRIC_CONFIG || !GROUPS) {
        console.error('METRIC_CONFIG or GROUPS not found');
        return;
    }
    
    const metricsContainer = document.querySelector('.metrics .spotlight-container');
    const tableHead = document.querySelector('table thead');

    function initNavigation() {
        const brand = document.querySelector('.brand');
        if (brand) {
            brand.addEventListener('click', () => window.location.href = '../');
            brand.setAttribute('role', 'button');
            brand.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = '../';
                }
            });
        }
        
        const outlineBtn = document.querySelector('.actions .button.outline');
        if (outlineBtn && outlineBtn.textContent === 'Archives') outlineBtn.addEventListener('click', () => window.location.href = '../archives/');
        else if (outlineBtn) outlineBtn.addEventListener('click', () => window.location.href = '../');
        
        const primaryBtn = document.querySelector('.actions .button.primary');
        if (primaryBtn && primaryBtn.textContent === 'About') primaryBtn.addEventListener('click', () => window.location.href = '../about/');
        else if (primaryBtn) primaryBtn.addEventListener('click', () => window.location.href = '../');
    }

    function initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) {
            console.warn('theme-toggle not found');
            return;
        }
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.classList.toggle('dark-mode', newTheme === 'dark');
            localStorage.setItem('theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
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
        const metricKey = METRIC_ID_TO_KEY[metricId];
        const group = metricKey ? METRIC_TO_GROUP[metricKey] : null;
        
        if (group) {
            localStorage.setItem('currentMetricGroup', group);
            renderTableHeaders(group);
            
            document.querySelectorAll('.metric').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            if (onMetricChangeCallback) {
                onMetricChangeCallback(group);
            }
        }
    });

    metricsContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const card = e.target.closest('.metric');
            if (card) card.click();
        }
    });

    initNavigation();
    initTheme();
}