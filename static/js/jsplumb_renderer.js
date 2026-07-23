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
            connectionsDetachable: false
        });

        onNodeMoveCallback = callbacks.onNodeMove || null;
        onOptionChangeCallback = callbacks.onOptionChange || null;
        onLabelChangeCallback = callbacks.onLabelChange || null;
        onNodeClickCallback = callbacks.onNodeClick || null;
        onEdgeClickCallback = callbacks.onEdgeClick || null;

        // 在 init 或 renderGraph 中（确保只绑定一次）
        instance.bind('click', function(connection, originalEvent) {
            if (connection && connection.data && connection.data.option_id) {
                var option_id = connection.data.option_id;
                // 获取 source/target 信息
                var ep1 = connection.endpoints[0];
                var ep2 = connection.endpoints[1];
                var sourceUuid = ep1.getUuid();
                var targetUuid = ep2.getUuid();
                var source = parseInt(sourceUuid.split('-')[1]);
                var target = parseInt(targetUuid.split('-')[1]);
                var sourceAnchor = sourceUuid.split('-')[2];
                var targetAnchor = targetUuid.split('-')[2];
                var label = connection.getOverlay('label') ? connection.getOverlay('label').getLabel() : '';
                if (onEdgeClickCallback) {
                    onEdgeClickCallback({
                        option_id: option_id,
                        source: source,
                        target: target,
                        label: label,
                        sourceAnchor: sourceAnchor,
                        targetAnchor: targetAnchor,
                        connection: connection  // 保留以便后续操作
                    });
                }
            }
        });

        return instance;
    }

    // 渲染图数据
    function renderGraph(nodes, edges) {
        console.log('🔄 renderGraph 被调用，节点数:', nodes ? nodes.length : 0, '边数:', edges ? edges.length : 0);
        if (!instance) {
            console.error('jsPlumb 未初始化');
            return;
        }
        console.log('instance:', instance);

        // 清空旧内容
        instance.deleteEveryConnection();
        instance.deleteEveryEndpoint();
        // 移除旧节点 DOM（保留容器）
        Object.values(nodeMap).forEach(el => {
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        nodeMap = {};
        endpointUuidMap = {};

        // 如果无节点，显示提示
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
            // 使用 pos_x, pos_y，若不存在则随机分配
            var x = node.pos_x || (100 + Math.random() * 300);
            var y = node.pos_y || (100 + Math.random() * 200);
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            container.appendChild(el);
            nodeMap[id] = el;
            // instance.revalidate(el);
            console.log(`✅ 创建节点 #${id}，位置: (${x}, ${y})`);

            el.className = 'node';
            if (id === selectedNodeId) {
                el.classList.add('selected-node');
            }

            // 在 renderGraph 中，创建节点后添加：
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var nodeId = parseInt(this.id.replace('node-', ''));
                console.log('🖱️ 点击节点 #' + nodeId);
                // 移除所有节点的高亮
                document.querySelectorAll('.node').forEach(function(n) {
                    n.classList.remove('selected-node');
                });
                // 高亮当前节点
                this.classList.add('selected-node');
                if (onNodeClickCallback) {
                    onNodeClickCallback(nodeId);
                }
            });

            // 添加四个方向的端点（上、下、左、右）
            var dirs = ['top', 'bottom', 'left', 'right'];
            var uuids = {};
            dirs.forEach(function(dir) {
                var uuid = 'node-' + id + '-' + dir;
                uuids[dir] = uuid;
                // 明确声明 ep，确保作用域在 forEach 内
                var ep = instance.addEndpoint(el, {
                    uuid: uuid,
                    anchor: dir.charAt(0).toUpperCase() + dir.slice(1),
                    maxConnections: -1,
                    source: true,
                    target: true,
                    dragOptions: { allowDetach: false }
                });
                if (ep) {
                    // ✅ 传递事件对象
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
                // 禁止拖拽端点时断开连接
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

        // 建立连线（若存在 edges 数据）
        if (edges && edges.length) {
                console.log(`🔗 开始建立 ${edges.length} 条连线`);
                edges.forEach(function(edge) {  // 注意：只声明 edge，不声明 index
                    var sourceUuid = 'node-' + edge.source + '-' + (edge.sourceAnchor || 'right');
                    var targetUuid = 'node-' + edge.target + '-' + (edge.targetAnchor || 'left');
                    try {
                        var conn = instance.connect({
                            uuids: [sourceUuid, targetUuid],
                            paintStyle: { stroke: getRandomColor(), strokeWidth: 2 },
                            data: { option_id: edge.option_id }  // ✅ 存储 option_id
                        });
                        if (conn) {
                            var label = edge.label || '连线';
                            var overlay = conn.getOverlay('label');
                            if (overlay) overlay.setLabel(label);
                            console.log(`  ✅ 连线 ${edge.source}→${edge.target} (${label})`);
                        }
                    } catch (e) {
                        // 此处不使用任何未定义变量，只输出 edge 信息
                        console.warn(`  ❌ 连线失败: ${edge.source}→${edge.target}`, e);
                    }
                });
            }

        // 刷新画布
        instance.repaintEverything();
        console.log('✅ renderGraph 完成');
    }


    function handleEndpointClick(endpoint, originalEvent) {
        // 过滤连线点击（避免误触端点）
        if (originalEvent && originalEvent.target && originalEvent.target.closest('.jtk-connector')) {
            return;
        }
        // 如果没有选中的端点，则选中当前端点
        if (!selectedEndpoint) {
            selectedEndpoint = endpoint;
            endpoint.addClass('selected');
            return;
        }

        // 点击同一个端点，取消选中
        if (selectedEndpoint === endpoint) {
            endpoint.removeClass('selected');
            selectedEndpoint = null;
            return;
        }

        var sourceEp = selectedEndpoint;
        var targetEp = endpoint;

        // 禁止自连接（同一节点）
        var sourceNodeId = sourceEp.elementId.replace('node-', '');
        var targetNodeId = targetEp.elementId.replace('node-', '');
        if (sourceNodeId === targetNodeId) {
            alert('不能连接同一个节点');
            sourceEp.removeClass('selected');
            selectedEndpoint = null;
            return;
        }

        // 检查是否已存在连接
        var existingConn = findConnectionBetweenEndpoints(sourceEp, targetEp);
        if (existingConn) {
            // 已存在，询问是否删除
            if (confirm('该连接已存在，是否删除？')) {
                instance.deleteConnection(existingConn);
                // 触发回调（通知外部更新 options）
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
            // 创建新连接
            var color = getRandomColor();
            var conn = instance.connect({
                uuids: [sourceEp.getUuid(), targetEp.getUuid()],
                paintStyle: { stroke: color, strokeWidth: 2 }
            });
            if (conn) {
                var label = '新连线';
                var overlay = conn.getOverlay('label');
                if (overlay) overlay.setLabel(label);
                // 触发回调（通知外部添加 options）
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

        // 清除选中状态
        sourceEp.removeClass('selected');
        selectedEndpoint = null;
    }


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

        // ✅ 确保 instance 存在
        if (!instance) {
            return { nodes: nodesData, edges: [] };
        }

        // ✅ 关键修复：获取所有连接
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

    // 获取当前最大节点 ID（用于新增）
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
            var ep = instance.addEndpoint(el, {
                uuid: uuid,
                anchor: dir.charAt(0).toUpperCase() + dir.slice(1),
                maxConnections: -1,
                source: true,
                target: true,
                dragOptions: { allowDetach: false }
            });
            if (ep) {
                // ✅ 传递事件对象
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
        // 删除相关连接
        var connections = instance.getConnections();
        connections.forEach(function(conn) {
            var sourceId = conn.sourceId;
            var targetId = conn.targetId;
            if (sourceId === 'node-' + nodeId || targetId === 'node-' + nodeId) {
                instance.deleteConnection(conn);
            }
        });
        // 删除端点
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
        // 清空容器
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

    function highlightNode(nodeId) {
        // 清除之前的高亮
        if (selectedNodeId !== null) {
            var prevEl = nodeMap[selectedNodeId];
            if (prevEl) {
                prevEl.classList.remove('node-selected');
            }
        }
        selectedNodeId = nodeId;
        if (nodeId !== null) {
            var el = nodeMap[nodeId];
            if (el) {
                el.classList.add('node-selected');
            }
        }
    }

    // 解决page_id自增生成节点，删除了不能再复用
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
        getNextAvailablePageId:getNextAvailablePageId,
    };
})();