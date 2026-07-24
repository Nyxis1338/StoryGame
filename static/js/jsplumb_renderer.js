// jsplumb_renderer.js
var JsPlumbRenderer = (function() {
    var instance = null;
    var container = null;
    var nodeMap = {};
    var endpointUuidMap = {};
    var onNodeMoveCallback = null;
    var onOptionChangeCallback = null;
    var onLabelChangeCallback = null;
    var selectedEndpoint = null;   // 记录当前选中的端点
    var selectedNodeId = null;
    var onEdgeClickCallback = null;

    // 初始化
    function init(containerId, callbacks) {
        container = document.getElementById(containerId);
        if (!container) {
            console.error('容器不存在:', containerId);
            return null;
        }

        instance = jsPlumb.getInstance({
            Container: container,
            // Anchor: "AutoDefault",  // 可选，如需自动锚点可启用
            DragOptions: { cursor: 'grab', zIndex: 2000 },
            Connector: ['Flowchart', { cornerRadius: 5 }],
            PaintStyle: { stroke: '#7f8c8d', strokeWidth: 2 },
            HoverPaintStyle: { stroke: '#1a73e8', strokeWidth: 3 },
            Endpoint: ['Dot', { radius: 5 }],
            EndpointStyle: { fill: '#fff', stroke: '#5470c6', strokeWidth: 2 },
            EndpointHoverStyle: { fill: '#1a73e8', stroke: '#1a73e8' },
            ConnectionOverlays: [
                ['Label', { label: '', cssClass: 'jsplumb-label', location: 0.5, id: 'label' }]
            ],
            // connectionsDetachable: false // 可根据需要启用
        });

        onNodeMoveCallback = callbacks.onNodeMove || null;
        onOptionChangeCallback = callbacks.onOptionChange || null;
        onLabelChangeCallback = callbacks.onLabelChange || null;
        onNodeClickCallback = callbacks.onNodeClick || null;
        onEdgeClickCallback = callbacks.onEdgeClick || null;


        return instance;
    }

    // 渲染图数据
    function renderGraph(nodes, edges) {
        console.log('🔄 renderGraph 被调用，节点数:', nodes ? nodes.length : 0, '边数:', edges ? edges.length : 0);
        if (!instance) {
            console.error('jsPlumb 未初始化');
            return;
        }

        // 清空旧内容
        instance.deleteEveryConnection();
        instance.deleteEveryEndpoint();
        Object.values(nodeMap).forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        nodeMap = {};
        endpointUuidMap = {};

        if (!nodes || nodes.length === 0) {
            console.warn('⚠️ 无节点数据，显示空状态');
            container.innerHTML = '<div style="padding:20px; color:#999; text-align:center;">暂无页面</div>';
            return;
        }

        // 为每个节点创建 DOM 元素
        nodes.forEach(function(node) {
            var id = node.id;
            var el = document.createElement('div');
            el.id = 'node-' + id;
            el.className = 'node';
            el.textContent = node.label || ('第' + id + '页');
            var x = node.pos_x || (100 + Math.random() * 300);
            var y = node.pos_y || (100 + Math.random() * 200);
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            container.appendChild(el);
            nodeMap[id] = el;

            if (id === selectedNodeId) {
                el.classList.add('selected-node');
            }

            // 节点点击事件
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var nodeId = parseInt(this.id.replace('node-', ''));
                console.log('🖱️ 点击节点 #' + nodeId);
                document.querySelectorAll('.node').forEach(function(n) {
                    n.classList.remove('selected-node');
                });
                this.classList.add('selected-node');
                if (onNodeClickCallback) {
                    onNodeClickCallback(nodeId);
                }
            });

            // 添加四个方向的端点
            var dirs = ['top', 'bottom', 'left', 'right'];
            var uuids = {};
            dirs.forEach(function(dir) {
                var uuid = 'node-' + id + '-' + dir;
                uuids[dir] = uuid;
                var ep = instance.addEndpoint(el, {
                    uuid: uuid,
                    anchor: dir.charAt(0).toUpperCase() + dir.slice(1),
                    maxConnections: -1,
                    source: true,
                    target: true,
                    dragOptions: { allowDetach: false }
                });
                if (ep) {
                    ep.bind('click', function(endpoint, originalEvent) {
                        handleEndpointClick(endpoint, originalEvent);
                    });
                    console.log('  ↳ 添加端点 ' + uuid);
                } else {
                    console.warn('⚠️ 端点添加失败:', uuid);
                }
            });
            endpointUuidMap[id] = uuids;
        });

        // 使所有节点可拖拽
        var nodeEls = Object.values(nodeMap);
        if (nodeEls.length) {
            instance.draggable(nodeEls, {
                containment: container,
                grid: [10, 10],
                allowDetach: false,
                stop: function(params) {
                    var el = params.el;
                    var id = parseInt(el.id.replace('node-', ''));
                    var left = parseFloat(el.style.left);
                    var top = parseFloat(el.style.top);
                    console.log(`📍 节点 #${id} 移动到 (${left}, ${top})`);
                    if (onNodeMoveCallback) {
                        onNodeMoveCallback(id, left, top);
                    }
                }
            });
            console.log('✅ 所有节点已启用拖拽');
        }

        // 建立连线
        if (edges && edges.length) {
            console.log(`🔗 开始建立 ${edges.length} 条连线`);
            edges.forEach(function(edge) {
                var sourceUuid = 'node-' + edge.source + '-' + (edge.sourceAnchor || 'right');
                var targetUuid = 'node-' + edge.target + '-' + (edge.targetAnchor || 'left');
                try {
                    var conn = instance.connect({
                        uuids: [sourceUuid, targetUuid],
                        paintStyle: { stroke: getRandomColor(), strokeWidth: 2 }
                        // 不再使用 data
                    });
                    if (conn) {
                        var label = edge.label || '连线';
                        var overlay = conn.getOverlay('label');
                        if (overlay) overlay.setLabel(label);
                        // 存储 option_id 到 connection 对象（自定义属性）
                        conn.option_id = edge.option_id;  // 直接挂载
                        // 为每条连线绑定点击事件（替代全局 bind）
                        conn.bind('click', function(connection) {
                            // 在此处触发回调，传递 option_id
                            if (onEdgeClickCallback) {
                                var ep1 = connection.endpoints[0];
                                var ep2 = connection.endpoints[1];
                                var sourceUuid = ep1.getUuid();
                                var targetUuid = ep2.getUuid();
                                var source = parseInt(sourceUuid.split('-')[1]);
                                var target = parseInt(targetUuid.split('-')[1]);
                                var sourceAnchor = sourceUuid.split('-')[2];
                                var targetAnchor = targetUuid.split('-')[2];
                                var label = connection.getOverlay('label') ? connection.getOverlay('label').getLabel() : '';
                                onEdgeClickCallback({
                                    option_id: connection.option_id,  // 从自定义属性获取
                                    source: source,
                                    target: target,
                                    label: label,
                                    sourceAnchor: sourceAnchor,
                                    targetAnchor: targetAnchor,
                                    connection: connection
                                });
                            }
                        });
                        console.log(`  ✅ 连线 ${edge.source}→${edge.target} (${label})`);
                    }
                } catch (e) {
                    console.warn(`  ❌ 连线失败: ${edge.source}→${edge.target}`, e);
                }
            });
        }

        instance.repaintEverything();
        console.log('✅ renderGraph 完成');
    }

    // 处理端点点击（用于创建或删除连接）
    function handleEndpointClick(endpoint, originalEvent) {
        // 过滤连线点击（避免误触端点）
        if (originalEvent && originalEvent.target && originalEvent.target.closest('.jtk-connector')) {
            return;
        }

        if (!selectedEndpoint) {
            selectedEndpoint = endpoint;
            endpoint.addClass('selected');
            return;
        }

        if (selectedEndpoint === endpoint) {
            endpoint.removeClass('selected');
            selectedEndpoint = null;
            return;
        }

        var sourceEp = selectedEndpoint;
        var targetEp = endpoint;

        var sourceNodeId = sourceEp.elementId.replace('node-', '');
        var targetNodeId = targetEp.elementId.replace('node-', '');
        if (sourceNodeId === targetNodeId) {
            alert('不能连接同一个节点');
            sourceEp.removeClass('selected');
            selectedEndpoint = null;
            return;
        }

        var existingConn = findConnectionBetweenEndpoints(sourceEp, targetEp);
        if (existingConn) {
            if (confirm('该连接已存在，是否删除？')) {
                instance.deleteConnection(existingConn);
                if (onOptionChangeCallback) {
                    onOptionChangeCallback(
                        parseInt(sourceNodeId),
                        parseInt(targetNodeId),
                        'remove',
                        null
                    );
                }
            }
        } else {
            var color = getRandomColor();
            var conn = instance.connect({
                uuids: [sourceEp.getUuid(), targetEp.getUuid()],
                paintStyle: { stroke: color, strokeWidth: 2 }
            });
            if (conn) {
                var label = '新连线';
                var overlay = conn.getOverlay('label');
                if (overlay) overlay.setLabel(label);
                if (onOptionChangeCallback) {
                    onOptionChangeCallback(
                        parseInt(sourceNodeId),
                        parseInt(targetNodeId),
                        'add',
                        label
                    );
                }
            }
        }

        sourceEp.removeClass('selected');
        selectedEndpoint = null;
    }

    // 查找两个端点之间的连接
    function findConnectionBetweenEndpoints(ep1, ep2) {
        var uuid1 = ep1.getUuid();
        var uuid2 = ep2.getUuid();
        var connections = instance.getConnections();
        for (var i = 0; i < connections.length; i++) {
            var conn = connections[i];
            var epA = conn.endpoints[0];
            var epB = conn.endpoints[1];
            if ((epA.getUuid() === uuid1 && epB.getUuid() === uuid2) ||
                (epA.getUuid() === uuid2 && epB.getUuid() === uuid1)) {
                return conn;
            }
        }
        return null;
    }

    // 获取当前图数据
    function getGraphData() {
        var nodesData = [];
        Object.keys(nodeMap).forEach(function(id) {
            var el = nodeMap[id];
            var left = parseFloat(el.style.left) || 0;
            var top = parseFloat(el.style.top) || 0;
            nodesData.push({
                id: parseInt(id),
                pos_x: left,
                pos_y: top
            });
        });

        if (!instance) {
            return { nodes: nodesData, edges: [] };
        }

        var connections = instance.getConnections();
        var edgesData = connections.map(function(conn) {
            var ep1 = conn.endpoints[0];
            var ep2 = conn.endpoints[1];
            var label = conn.getOverlay('label') ? conn.getOverlay('label').getLabel() : '';
            var sourceUuid = ep1.getUuid();
            var targetUuid = ep2.getUuid();
            var sourceId = parseInt(sourceUuid.split('-')[1]);
            var targetId = parseInt(targetUuid.split('-')[1]);
            var sourceDir = sourceUuid.split('-')[2];
            var targetDir = targetUuid.split('-')[2];
            return {
                source: sourceId,
                target: targetId,
                label: label,
                sourceAnchor: sourceDir,
                targetAnchor: targetDir,
                option_id: conn.data ? conn.data.option_id : null
            };
        });
        return { nodes: nodesData, edges: edgesData };
    }

    // 获取当前最大节点 ID
    function getMaxNodeId() {
        var ids = Object.keys(nodeMap).map(Number);
        return ids.length ? Math.max.apply(null, ids) : 0;
    }

    // 添加节点（由外部调用）
    function addNode(nodeData) {
        var id = nodeData.id;
        var el = document.createElement('div');
        el.id = 'node-' + id;
        el.className = 'node';
        el.textContent = nodeData.label || ('第' + id + '页');
        var x = nodeData.pos_x || (100 + Math.random() * 300);
        var y = nodeData.pos_y || (100 + Math.random() * 200);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        container.appendChild(el);
        nodeMap[id] = el;

        var dirs = ['top', 'bottom', 'left', 'right'];
        var uuids = {};
        dirs.forEach(function(dir) {
            var uuid = 'node-' + id + '-' + dir;
            uuids[dir] = uuid;
            var ep = instance.addEndpoint(el, {
                uuid: uuid,
                anchor: dir.charAt(0).toUpperCase() + dir.slice(1),
                maxConnections: -1,
                source: true,
                target: true,
                dragOptions: { allowDetach: false }
            });
            if (ep) {
                ep.bind('click', function(endpoint, originalEvent) {
                    handleEndpointClick(endpoint, originalEvent);
                });
                console.log('  ↳ 添加端点 ' + uuid);
            } else {
                console.warn('⚠️ 端点添加失败:', uuid);
            }
        });
        endpointUuidMap[id] = uuids;

        instance.draggable(el, {
            containment: container,
            grid: [10, 10],
            stop: function(params) {
                var left = parseFloat(el.style.left);
                var top = parseFloat(el.style.top);
                if (onNodeMoveCallback) {
                    onNodeMoveCallback(id, left, top);
                }
            }
        });
        instance.repaintEverything();
        return el;
    }

    // 删除节点
    function deleteNode(nodeId) {
        var el = nodeMap[nodeId];
        if (!el) return false;
        var connections = instance.getConnections();
        connections.forEach(function(conn) {
            var sourceId = conn.sourceId;
            var targetId = conn.targetId;
            if (sourceId === 'node-' + nodeId || targetId === 'node-' + nodeId) {
                instance.deleteConnection(conn);
            }
        });
        var uuids = endpointUuidMap[nodeId];
        if (uuids) {
            Object.values(uuids).forEach(function(uuid) {
                var ep = instance.getEndpoint(uuid);
                if (ep) instance.deleteEndpoint(ep);
            });
        }
        el.parentNode.removeChild(el);
        delete nodeMap[nodeId];
        delete endpointUuidMap[nodeId];
        instance.repaintEverything();
        return true;
    }

    // 画布尺寸调整
    function resize() {
        if (instance) {
            instance.repaintEverything();
        }
    }

    // 销毁
    function destroy() {
        if (instance) {
            instance.deleteEveryConnection();
            instance.deleteEveryEndpoint();
            instance.reset();
        }
        if (container) {
            container.innerHTML = '';
        }
        nodeMap = {};
        endpointUuidMap = {};
    }

    // 辅助：随机颜色
    function getRandomColor() {
        var colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#e84393', '#00b894', '#fd79a8'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 高亮节点
    function highlightNode(nodeId) {
        if (selectedNodeId !== null) {
            var prevEl = nodeMap[selectedNodeId];
            if (prevEl) {
                prevEl.classList.remove('selected-node');
            }
        }
        selectedNodeId = nodeId;
        if (nodeId !== null) {
            var el = nodeMap[nodeId];
            if (el) {
                el.classList.add('selected-node');
            }
        }
    }

    // 获取下一个可用的 page_id（复用已删除的空缺）
    function getNextAvailablePageId() {
        var existingIds = Object.keys(nodeMap).map(Number);
        existingIds.sort((a, b) => a - b);
        var nextId = 1;
        for (var i = 0; i < existingIds.length; i++) {
            if (existingIds[i] === nextId) {
                nextId++;
            } else if (existingIds[i] > nextId) {
                break;
            }
        }
        return nextId;
    }

    // 公开 API
    return {
        init: init,
        renderGraph: renderGraph,
        getGraphData: getGraphData,
        addNode: addNode,
        deleteNode: deleteNode,
        getMaxNodeId: getMaxNodeId,
        resize: resize,
        destroy: destroy,
        highlightNode: highlightNode,
        getNextAvailablePageId: getNextAvailablePageId,
    };
})();