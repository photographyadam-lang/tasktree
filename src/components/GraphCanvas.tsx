import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import type {
  Connection,
  Edge,
  Node,
  OnSelectionChangeParams
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { db } from '../db';
import type { TaskEdge } from '../types';
import { TaskGraphNode } from './TaskGraphNode';
import { isChildStale, getAncestorPath } from '../utils/graphQueries';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = 'top' as any;
    node.sourcePosition = 'bottom' as any;
    
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes, edges };
};

type GraphCanvasProps = {
  activeNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
};

import { useLiveQuery } from 'dexie-react-hooks';

export function GraphCanvas({ activeNodeId, onNodeSelect }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ taskGraphNode: TaskGraphNode }), []);

  const dbNodes = useLiveQuery(() => db.nodes.toArray(), []);
  const dbEdges = useLiveQuery(() => db.edges.toArray(), []);

  useEffect(() => {
    let active = true;
    async function buildLayout() {
      if (!dbNodes || !dbEdges) return;

      const initialEdges: Edge[] = dbEdges.map((e) => ({
        id: e.id,
        source: e.source_id,
        target: e.target_id,
        type: 'default',
        animated: e.relationship_type === 'depends_on'
      }));

      let ancestorIds = new Set<string>();
      if (activeNodeId) {
        const ancestors = await getAncestorPath(activeNodeId);
        ancestorIds = new Set(ancestors.map(a => a.id));
      }

      const initialNodes: Node[] = dbNodes.map(node => {
        const parent = dbNodes.find(n => n.id === node.parent_id);
        const isStale = parent ? isChildStale(parent, node) : false;

        return {
          id: node.id,
          type: 'taskGraphNode',
          position: { x: 0, y: 0 },
          data: {
            taskNode: node,
            isStale,
            isAncestor: ancestorIds.has(node.id) && node.id !== activeNodeId
          }
        };
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      );

      if (active) {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      }
    }
    buildLayout();
    return () => { active = false; };
  }, [dbNodes, dbEdges, activeNodeId, setNodes, setEdges]);

  const onConnect = useCallback(async (connection: Connection) => {
    const newEdgeId = crypto.randomUUID();
    const dbEdge: TaskEdge = {
      id: newEdgeId,
      source_id: connection.source!,
      target_id: connection.target!,
      relationship_type: 'depends_on'
    };
    await db.edges.put(dbEdge);
    setEdges((eds) => addEdge({
      id: newEdgeId,
      source: connection.source!,
      target: connection.target!,
      animated: true
    }, eds));
  }, [setEdges]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const selectedNodes = params.nodes;
    if (selectedNodes.length === 1) {
      onNodeSelect(selectedNodes[0].id);
    } else if (selectedNodes.length === 0) {
      onNodeSelect(null);
    }
  }, [onNodeSelect]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
