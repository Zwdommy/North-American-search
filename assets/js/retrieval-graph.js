/**
 * Retrieval graph: 2D force-directed (Obsidian-style).
 * Nodes = query + papers (AI-ranked); links = query–paper (relevance) + paper–paper (similarity).
 */
'use strict';

(function (global) {
  if (typeof global.d3 === 'undefined') {
    console.warn('Retrieval graph: d3 must be loaded first.');
    return;
  }

  var d3 = global.d3;

  function initRetrievalGraph(containerEl, opts) {
    if (!containerEl || !opts) return null;
    var query = opts.query || 'Query';
    var papers = opts.papers || [];
    var similarities = opts.similarities || [];
    var yearFilter = opts.yearFilter || 'all';
    var onOpenPaper = opts.onOpenPaper || function () {};

    var papersFiltered = papers;
    if (yearFilter !== 'all') {
      var minYear = parseInt(yearFilter, 10);
      papersFiltered = papers.filter(function (p) { return (p.year || 0) >= minYear; });
    }
    papersFiltered = papersFiltered.slice(0, 12);

    var nodes = [];
    var links = [];

    var queryId = 'query';
    nodes.push({
      id: queryId,
      label: (query.length > 24 ? query.slice(0, 22) + '…' : query),
      isQuery: true,
      paper: null
    });

    papersFiltered.forEach(function (p) {
      nodes.push({
        id: p.id,
        label: (p.title || p.id || '').trim().length > 20 ? (p.title || p.id).trim().slice(0, 18) + '…' : (p.title || p.id || ''),
        isQuery: false,
        paper: p,
        score: typeof p._aiScore === 'number' ? p._aiScore : 0.5
      });
      links.push({ source: queryId, target: p.id, type: 'relevance' });
    });

    similarities.forEach(function (link) {
      if (!link || typeof link.similarity !== 'number' || link.similarity < 0.2) return;
      var a = link.a;
      var b = link.b;
      if (!a || !b) return;
      var hasA = nodes.some(function (n) { return n.id === a; });
      var hasB = nodes.some(function (n) { return n.id === b; });
      if (hasA && hasB) links.push({ source: a, target: b, type: 'similarity', value: link.similarity });
    });

    var width = containerEl.clientWidth || 640;
    var height = Math.min(420, Math.max(320, containerEl.clientHeight || 400));

    containerEl.innerHTML = '';
    var svg = d3.select(containerEl)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    var g = svg.append('g');

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (d) {
        return d.type === 'relevance' ? 90 : 70;
      }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(function (d) { return d.isQuery ? 18 : 14; }));

    var link = g.append('g')
      .attr('class', 'retrieval-graph-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#b0b0b0')
      .attr('stroke-opacity', 0.65)
      .attr('stroke-width', 1);

    var node = g.append('g')
      .attr('class', 'retrieval-graph-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', function (d) { return d.isQuery ? 'default' : 'pointer'; })
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    node.append('circle')
      .attr('r', function (d) { return d.isQuery ? 10 : 6; })
      .attr('fill', function (d) { return d.isQuery ? '#5c5c5c' : '#6b6b6b'; })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    node.append('text')
      .text(function (d) { return d.label || d.id; })
      .attr('font-size', 11)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#333')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('pointer-events', 'none');

    node.on('click', function (event, d) {
      event.stopPropagation();
      if (d.isQuery || !d.paper) return;
      onOpenPaper(d.paper);
    });

    function dragStarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragEnded(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    simulation.on('tick', function () {
      link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });
      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });

    var zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', function (event) {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    function onResize() {
      var w = containerEl.clientWidth || 640;
      var h = Math.min(420, Math.max(320, containerEl.clientHeight || 400));
      svg.attr('width', w).attr('height', h).attr('viewBox', [0, 0, w, h]);
      simulation.force('center', d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    }
    global.addEventListener('resize', onResize);

    return {
      destroy: function () {
        global.removeEventListener('resize', onResize);
        simulation.stop();
        containerEl.innerHTML = '';
      },
      setYearFilter: function (y) {
        yearFilter = y;
      }
    };
  }

  global.initRetrievalGraph = initRetrievalGraph;
})(typeof window !== 'undefined' ? window : this);
