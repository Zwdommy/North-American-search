/**
 * Semantic index network view: 2D force-directed graph (Obsidian-style).
 * D3 only: SVG + d3-force, no 3D. Minimalist: dark grey nodes, thin lines, light background.
 */
'use strict';

(function (global) {
  if (typeof global.d3 === 'undefined') {
    console.warn('Semantic network: d3 must be loaded first.');
    return;
  }

  var d3 = global.d3;

  function flattenTree(root, nodes, links, parentId) {
    if (!root) return;
    var id = root.id || 'node-' + nodes.length;
    var node = {
      id: id,
      label: root.label || id,
      content: root.content,
      position: root.position,
      depth: parentId === null ? 0 : (nodes.find(function (n) { return n.id === parentId; }) || {}).depth + 1
    };
    nodes.push(node);
    if (parentId !== null) {
      links.push({ source: parentId, target: id });
    }
    var children = root.children;
    if (Array.isArray(children)) {
      children.forEach(function (child) {
        flattenTree(child, nodes, links, id);
      });
    }
  }

  function initSemanticNetwork(containerEl, tree, pdfHref, highlightPage) {
    if (!containerEl || !tree) return null;

    var nodes = [];
    var links = [];
    flattenTree(tree, nodes, links, null);

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
      .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(70).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(28));

    var link = g.append('g')
      .attr('class', 'semantic-network-links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#b0b0b0')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1.2);

    var node = g.append('g')
      .attr('class', 'semantic-network-nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', function (d) {
        var isHighlight = highlightPage != null && d.position && typeof d.position.page === 'number' && d.position.page === highlightPage;
        return isHighlight ? 'semantic-network-node-highlight' : '';
      })
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    node.append('circle')
      .attr('r', function (d) { return d.id === 'root' ? 10 : 6; })
      .attr('fill', function (d) {
        var isHighlight = highlightPage != null && d.position && typeof d.position.page === 'number' && d.position.page === highlightPage;
        if (isHighlight) return '#0d7377';
        return d.id === 'root' ? '#5c5c5c' : '#6b6b6b';
      })
      .attr('stroke', function (d) {
        var isHighlight = highlightPage != null && d.position && typeof d.position.page === 'number' && d.position.page === highlightPage;
        return isHighlight ? '#0d7377' : '#fff';
      })
      .attr('stroke-width', 1);

    node.append('text')
      .text(function (d) {
        var lab = (d.label || '').trim();
        return lab.length > 18 ? lab.slice(0, 16) + '…' : lab;
      })
      .attr('font-size', 11)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('fill', '#333')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('pointer-events', 'none');

    node.on('click', function (event, d) {
      event.stopPropagation();
      if (d.position && typeof d.position.page === 'number' && pdfHref) {
        global.open(pdfHref + '#page=' + d.position.page, '_blank');
      }
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
      }
    };
  }

  global.initSemanticNetwork = initSemanticNetwork;
})(typeof window !== 'undefined' ? window : this);
