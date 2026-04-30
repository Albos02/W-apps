document.addEventListener('DOMContentLoaded', () => {
    const { METRIC_CONFIG, GROUPS } = window.WindDashboard;
    const metricsContainer = document.querySelector('.metrics .spotlight-container');
    const tableHead = document.querySelector('table thead');

    // 1. Inject Metric Cards
    Object.entries(METRIC_CONFIG).forEach(([id, config]) => {
        const article = document.createElement('article');
        article.className = 'base-card card metric spotlight-item';
        article.dataset.metricId = id;
        article.tabIndex = 0;
        article.draggable = true;

        article.innerHTML = `
            <div class="spotlight-border"></div>
            <div class="spotlight-content">
                <div class="metric-value-wrapper">
                    <h3>${config.label}</h3>
                    <p class="value" id="current-${id}">-- ${config.unit}</p>
                    <p class="trend" id="trend-${id}">-- over last hour</p>
                </div>
            </div>
        `;
        metricsContainer.appendChild(article);
    });

    // 2. Inject Initial Table Headers (Default to Wind Group)
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

    // 3. Centralized Event Listeners
    
    // Navigation and Actions
    document.querySelector('.brand').addEventListener('click', () => window.location.href = '../');
    document.querySelector('.actions .button.outline').addEventListener('click', () => window.location.href = '../');
    document.querySelector('.actions .button.primary').addEventListener('click', () => window.location.href = '../');
    
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });

    // Metric Cards Interaction
    metricsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.metric');
        if (!card) return;
        
        const metricId = card.dataset.metricId;
        const group = Object.keys(GROUPS).find(g => GROUPS[g].includes(metricId));
        
        if (group) {
            console.log(`Switching to metric group: ${group}`);
            localStorage.setItem('currentMetricGroup', group);
            renderTableHeaders(group);
            
            // Update active state in UI
            document.querySelectorAll('.metric').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Trigger visualization update (to be implemented)
            if (window.updateVisualizations) window.updateVisualizations();
        }
    });

    // Metric Cards Context Menu (Right Click)
    metricsContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const card = e.target.closest('.metric');
        const metricId = card ? card.dataset.metricId : null;
        
        if (typeof window.showUnifiedMenu === 'function') {
            window.showUnifiedMenu(e, metricId);
        }
    });

    // Handle Keyboard (Enter/Space)
    metricsContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.target.click();
        }
    });

    console.log('UI initialized from METRIC_CONFIG');
});
