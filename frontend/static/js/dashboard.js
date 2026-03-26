document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/signin';
        return;
    }

    try {
        const response = await fetch('/api/profile/dashboard_data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            // Populate Metrics
            document.getElementById('healthScore').innerText = data.health_score;
            document.getElementById('bmiValue').innerText = data.bmi ? data.bmi : 'N/A';
            document.getElementById('questionsCount').innerText = data.queries_count;
            document.getElementById('messagesCount').innerText = data.total_messages;
            
            // Set BMI Category Text Coloring
            const bmiCat = document.getElementById('bmiCategory');
            if (data.bmi) {
                if (data.bmi > 25) { bmiCat.style.color = '#ef4444'; bmiCat.innerText = 'Overweight'; }
                else if (data.bmi < 18.5) { bmiCat.style.color = '#ef4444'; bmiCat.innerText = 'Underweight'; }
                else { bmiCat.style.color = '#10b981'; bmiCat.innerText = 'Normal Range'; }
            } else {
                bmiCat.innerText = 'Missing Weight/Height in Profile';
            }

            // Populate Risk Factors
            const riskList = document.getElementById('riskList');
            if (data.risk_factors.length === 0) {
                riskList.innerHTML = '<div style="padding: 1rem; color: #10b981; font-weight: bold;">No major risks detected!</div>';
            } else {
                riskList.innerHTML = data.risk_factors.map(risk => 
                    `<li class="risk-item" style="color: #ef4444; font-weight: 500;">${risk}</li>`
                ).join('');
            }

            // Trend Chart (Mock History Data since we don't have time-series queries easily)
            const ctxTrend = document.getElementById('trendChart').getContext('2d');
            new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Current Month'],
                    datasets: [{
                        label: 'Chat AI Messages',
                        data: [0, 0, 0, 0, 0, data.total_messages], // Showing growth toward current
                        borderColor: '#2563eb',
                        tension: 0.3,
                        fill: true,
                        backgroundColor: 'rgba(37, 99, 235, 0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' }
                    }
                }
            });

            // Radar Chart for Overall Wellness Metrics
            const ctxRadar = document.getElementById('radarChart').getContext('2d');
            new Chart(ctxRadar, {
                type: 'radar',
                data: {
                    labels: ['Overall Health Score', 'BMI Normalcy', 'Lifestyle Fitness', 'Medical History Health', 'Activity'],
                    datasets: [{
                        label: 'Current Wellness',
                        data: [
                            data.health_score, 
                            data.bmi && data.bmi >= 18.5 && data.bmi <= 25 ? 100 : 50, // BMI OK?
                            data.risk_factors.includes("Smoking") || data.risk_factors.includes("Alcohol") ? 40 : 90, 
                            data.risk_factors.length > 2 ? 30 : 80, 
                            data.queries_count > 0 ? 80 : 20 // Engagement
                        ],
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderColor: '#10b981',
                        pointBackgroundColor: '#10b981'
                    }]
                },
                options: {
                    scales: {
                        r: { beginAtZero: true, max: 100 }
                    }
                }
            });

        } else {
            console.error('Failed to load dashboard data');
            document.getElementById('riskList').innerHTML = '<div style="color:red">Error loading profile data.</div>';
        }
    } catch (e) {
        console.error(e);
    }
});
