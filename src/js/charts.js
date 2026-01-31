/**
 * Nocturne Charts Library
 * Lightweight SVG-based charting for dashboards
 */

class NocturneCharts {
  /**
     * Create a line/area chart
     */
  static lineChart(container, data, options = {}) {
    const {
      width = 300,
      height = 150,
      padding = { top: 10, right: 10, bottom: 25, left: 40 },
      lineColor = '#6366f1',
      fillColor = 'rgba(99, 102, 241, 0.2)',
      showGrid = true,
      showLabels = true,
      showDots = false,
      animate = true
    } = options;

    if (!data || data.length < 2) {
      container.innerHTML = '<div class="chart-no-data">No data available</div>';
      return;
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    // Scale functions
    const scaleX = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
    const scaleY = (v) => padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

    // Build path
    const linePath = data.map((d, i) => {
      const x = scaleX(i);
      const y = scaleY(d.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Area fill path
    const areaPath = `${linePath} L ${scaleX(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

    // Grid lines
    let gridLines = '';
    if (showGrid) {
      const numGridLines = 4;
      for (let i = 0; i <= numGridLines; i++) {
        const y = padding.top + (i / numGridLines) * chartHeight;
        gridLines += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"/>`;
      }
    }

    // Y-axis labels
    let yLabels = '';
    if (showLabels) {
      const numLabels = 4;
      for (let i = 0; i <= numLabels; i++) {
        const val = maxVal - (i / numLabels) * range;
        const y = padding.top + (i / numLabels) * chartHeight;
        yLabels += `<text x="${padding.left - 5}" y="${y + 4}" class="y-label">${this.formatValue(val)}</text>`;
      }
    }

    // X-axis labels
    let xLabels = '';
    if (showLabels && data[0].label) {
      const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];
      labelIndices.forEach(i => {
        if (data[i]?.label) {
          xLabels += `<text x="${scaleX(i)}" y="${height - 5}" class="x-label">${data[i].label}</text>`;
        }
      });
    }

    // Dots
    let dots = '';
    if (showDots) {
      data.forEach((d, i) => {
        dots += `<circle cx="${scaleX(i)}" cy="${scaleY(d.value)}" r="3" class="chart-dot"/>`;
      });
    }

    const animationClass = animate ? 'animate-draw' : '';

    container.innerHTML = `
            <svg class="ow-chart line-chart ${animationClass}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${fillColor};stop-opacity:0.8"/>
                        <stop offset="100%" style="stop-color:${fillColor};stop-opacity:0"/>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path class="chart-area" d="${areaPath}" fill="url(#lineGradient)"/>
                <path class="chart-line" d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="2"/>
                ${dots}
                ${yLabels}
                ${xLabels}
            </svg>
        `;
  }

  /**
     * Create a candlestick chart
     */
  static candlestickChart(container, data, options = {}) {
    const {
      width = 400,
      height = 200,
      padding = { top: 15, right: 10, bottom: 30, left: 50 },
      upColor = '#22c55e',
      downColor = '#ef4444'
    } = options;

    if (!data || data.length < 2) {
      container.innerHTML = '<div class="chart-no-data">No data available</div>';
      return;
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const allValues = data.flatMap(d => [d.open, d.high, d.low, d.close]);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    const candleWidth = Math.max(4, (chartWidth / data.length) * 0.7);
    const candleSpacing = chartWidth / data.length;

    const scaleY = (v) => padding.top + chartHeight - ((v - minVal) / range) * chartHeight;

    let candles = '';
    data.forEach((d, i) => {
      const x = padding.left + i * candleSpacing + candleSpacing / 2;
      const isUp = d.close >= d.open;
      const color = isUp ? upColor : downColor;
            
      const bodyTop = scaleY(Math.max(d.open, d.close));
      const bodyBottom = scaleY(Math.min(d.open, d.close));
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);

      // Wick
      candles += `<line x1="${x}" y1="${scaleY(d.high)}" x2="${x}" y2="${scaleY(d.low)}" stroke="${color}" stroke-width="1"/>`;
            
      // Body
      candles += `<rect x="${x - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${isUp ? color : color}" stroke="${color}"/>`;
    });

    // Y-axis labels
    let yLabels = '';
    const numLabels = 4;
    for (let i = 0; i <= numLabels; i++) {
      const val = maxVal - (i / numLabels) * range;
      const y = padding.top + (i / numLabels) * chartHeight;
      yLabels += `<text x="${padding.left - 5}" y="${y + 4}" class="y-label">${this.formatValue(val)}</text>`;
    }

    container.innerHTML = `
            <svg class="ow-chart candlestick-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                ${candles}
                ${yLabels}
            </svg>
        `;
  }

  /**
     * Create a mini sparkline
     */
  static sparkline(container, values, options = {}) {
    const {
      width = 100,
      height = 30,
      color = 'auto',
      strokeWidth = 1.5
    } = options;

    if (!values || values.length < 2) {
      container.innerHTML = '';
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((val, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isUp = values[values.length - 1] > values[0];
    const strokeColor = color === 'auto' ? (isUp ? '#22c55e' : '#ef4444') : color;

    container.innerHTML = `
            <svg class="ow-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" points="${points}"/>
            </svg>
        `;
  }

  /**
     * Create a gauge/dial chart
     */
  static gaugeChart(container, value, options = {}) {
    const {
      min = 0,
      max = 100,
      size = 120,
      thickness = 10,
      label = '',
      colors = ['#ef4444', '#f59e0b', '#22c55e']
    } = options;

    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
    const radius = (size - thickness) / 2;
    const center = size / 2;
    const startAngle = -180;
    const endAngle = 0;
    const angle = startAngle + (percentage / 100) * (endAngle - startAngle);

    const describeArc = (cx, cy, r, startAngle, endAngle) => {
      const start = this.polarToCartesian(cx, cy, r, endAngle);
      const end = this.polarToCartesian(cx, cy, r, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
      return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    };

    // Color based on value
    const colorIndex = Math.min(colors.length - 1, Math.floor((percentage / 100) * colors.length));
    const currentColor = colors[colorIndex];

    container.innerHTML = `
            <svg class="ow-gauge" viewBox="0 0 ${size} ${size / 2 + 20}" preserveAspectRatio="xMidYMid meet">
                <!-- Background arc -->
                <path d="${describeArc(center, center, radius, startAngle, endAngle)}" 
                      fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="${thickness}" stroke-linecap="round"/>
                <!-- Value arc -->
                <path d="${describeArc(center, center, radius, startAngle, angle)}" 
                      fill="none" stroke="${currentColor}" stroke-width="${thickness}" stroke-linecap="round"/>
                <!-- Value text -->
                <text x="${center}" y="${center - 5}" class="gauge-value" text-anchor="middle">${Math.round(value)}</text>
                <text x="${center}" y="${center + 15}" class="gauge-label" text-anchor="middle">${label}</text>
            </svg>
        `;
  }

  /**
     * Create a bar chart
     */
  static barChart(container, data, options = {}) {
    const {
      width = 300,
      height = 150,
      padding = { top: 10, right: 10, bottom: 30, left: 40 },
      barColor = '#6366f1',
      showValues = true
    } = options;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="chart-no-data">No data available</div>';
      return;
    }

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = data.map(d => d.value);
    const maxVal = Math.max(...values, 0);

    const barWidth = Math.max(8, (chartWidth / data.length) * 0.7);
    const barSpacing = chartWidth / data.length;

    let bars = '';
    data.forEach((d, i) => {
      const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const barHeight = (d.value / maxVal) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      const color = d.color || barColor;

      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>`;
            
      if (showValues) {
        bars += `<text x="${x + barWidth / 2}" y="${y - 5}" class="bar-value">${this.formatValue(d.value)}</text>`;
      }
            
      if (d.label) {
        bars += `<text x="${x + barWidth / 2}" y="${height - 8}" class="x-label">${d.label}</text>`;
      }
    });

    container.innerHTML = `
            <svg class="ow-chart bar-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                ${bars}
            </svg>
        `;
  }

  // Helper functions
  static polarToCartesian(cx, cy, r, angle) {
    const rad = (angle - 90) * Math.PI / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  static formatValue(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    if (val >= 100) return Math.round(val).toString();
    if (val >= 1) return val.toFixed(1);
    return val.toFixed(2);
  }
}

// Export globally
window.NocturneCharts = NocturneCharts;
