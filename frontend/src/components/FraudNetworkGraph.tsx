"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  Node,
  Edge,
  NodeProps,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeStatus = "center" | "flagged" | "clean";

type EmployeeData = {
  name: string;
  role: string;
  fraudType: string;
  status: EmployeeStatus;
};

type EmployeeNode = Node<EmployeeData, "employee">;

// ─── Nodes ────────────────────────────────────────────────────────────────────

const INITIAL_NODES: EmployeeNode[] = [
  {
    id: "chukwuemeka",
    type: "employee",
    position: { x: 320, y: 155 },
    data: {
      name: "Chukwuemeka Obi",
      role: "Senior Accountant GL-12",
      fraudType: "Ghost Worker + Network Fraud",
      status: "center",
    },
  },
  {
    id: "adaeze",
    type: "employee",
    position: { x: 80, y: 35 },
    data: {
      name: "Adaeze Nwosu",
      role: "Finance Officer",
      fraudType: "Network Fraud",
      status: "flagged",
    },
  },
  {
    id: "emeka",
    type: "employee",
    position: { x: 556, y: 35 },
    data: {
      name: "Emeka Eze",
      role: "Budget Analyst",
      fraudType: "Duplicate Identity",
      status: "flagged",
    },
  },
  {
    id: "bola",
    type: "employee",
    position: { x: 80, y: 275 },
    data: {
      name: "Bola Adeyemi",
      role: "Payroll Officer",
      fraudType: "Ghost Worker",
      status: "flagged",
    },
  },
  {
    id: "kemi",
    type: "employee",
    position: { x: 556, y: 275 },
    data: {
      name: "Kemi Okafor",
      role: "Accounts Clerk",
      fraudType: "Salary Fraud",
      status: "flagged",
    },
  },
  {
    id: "tunde",
    type: "employee",
    position: { x: -155, y: -45 },
    data: {
      name: "Tunde Bakare",
      role: "Tax Officer",
      fraudType: "Network Fraud",
      status: "flagged",
    },
  },
  {
    id: "ngozi",
    type: "employee",
    position: { x: -155, y: 140 },
    data: {
      name: "Ngozi Amadi",
      role: "Finance Assistant",
      fraudType: "Ghost Worker",
      status: "flagged",
    },
  },
  {
    id: "hassan",
    type: "employee",
    position: { x: 758, y: 155 },
    data: {
      name: "Hassan Musa",
      role: "Revenue Officer",
      fraudType: "None",
      status: "clean",
    },
  },
];

// ─── Edges ────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fill: "#00D4FF",
  fontSize: 9,
  fontWeight: 600,
};

const LABEL_BG: React.CSSProperties = {
  fill: "#0D1426",
  fillOpacity: 0.92,
};

function makeEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  label: string,
  color: string
): Edge {
  return {
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    label,
    type: "smoothstep",
    animated: true,
    style: { stroke: color, strokeWidth: 1.5, strokeOpacity: 0.75 },
    labelStyle: LABEL_STYLE,
    labelBgStyle: LABEL_BG,
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  };
}

const INITIAL_EDGES: Edge[] = [
  // Center → first ring (shared bank account, red)
  makeEdge("e-c-adaeze",   "chukwuemeka", "sl", "adaeze", "tr", "Shared Bank Acct", "#FF3B5C"),
  makeEdge("e-c-emeka",    "chukwuemeka", "sr", "emeka",  "tl", "Shared Bank Acct", "#FF3B5C"),
  makeEdge("e-c-bola",     "chukwuemeka", "sl", "bola",   "tr", "Shared Bank Acct", "#FF3B5C"),
  makeEdge("e-c-kemi",     "chukwuemeka", "sr", "kemi",   "tl", "Shared Bank Acct", "#FF3B5C"),
  // Adaeze → second ring (shared phone, orange)
  makeEdge("e-adaeze-tunde", "adaeze", "sl", "tunde", "tr", "Shared Phone", "#FF9500"),
  makeEdge("e-adaeze-ngozi", "adaeze", "sl", "ngozi", "tr", "Shared Phone", "#FF9500"),
];

// ─── Node styling ─────────────────────────────────────────────────────────────

const STATUS: Record<
  EmployeeStatus,
  { bg: string; border: string; glow: string; textColor: string; size: number; fontSize: number }
> = {
  center: {
    bg: "linear-gradient(135deg, #FF3B5C 0%, #CC1A35 100%)",
    border: "#FF3B5C",
    glow: "0 0 0 4px rgba(255,59,92,0.2), 0 0 24px rgba(255,59,92,0.35)",
    textColor: "#fff",
    size: 90,
    fontSize: 10,
  },
  flagged: {
    bg: "linear-gradient(135deg, #200610 0%, #0D0208 100%)",
    border: "#FF3B5C",
    glow: "0 0 0 2px rgba(255,59,92,0.12)",
    textColor: "#FF3B5C",
    size: 76,
    fontSize: 9,
  },
  clean: {
    bg: "linear-gradient(135deg, #001A0A 0%, #000D05 100%)",
    border: "#00C853",
    glow: "0 0 0 2px rgba(0,200,83,0.15), 0 0 16px rgba(0,200,83,0.1)",
    textColor: "#00C853",
    size: 76,
    fontSize: 9,
  },
};

const HANDLE_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  width: 4,
  height: 4,
  minWidth: 4,
  minHeight: 4,
};

// ─── Custom node ──────────────────────────────────────────────────────────────

function EmployeeNodeComponent({ data }: NodeProps<EmployeeNode>) {
  const s = STATUS[data.status];
  const words = data.name.split(" ");

  return (
    <div
      style={{
        width: s.size,
        height: s.size,
        borderRadius: "50%",
        background: s.bg,
        border: `2px solid ${s.border}`,
        boxShadow: s.glow,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Invisible handles at all 4 sides for both source and target */}
      <Handle type="target" position={Position.Top}    id="tt" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="tb" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left}   id="tl" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right}  id="tr" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Top}    id="st" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="sb" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="sl" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="sr" style={HANDLE_STYLE} />

      {/* Name lines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          lineHeight: 1.25,
          padding: "0 8px",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              color: s.textColor,
              fontSize: s.fontSize,
              fontWeight: data.status === "center" ? 700 : 600,
              letterSpacing: "-0.01em",
              textAlign: "center",
              display: "block",
            }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Status dot at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.border,
          opacity: 0.8,
        }}
      />
    </div>
  );
}

// Must be stable (outside component) to prevent React Flow re-renders
const NODE_TYPES = { employee: EmployeeNodeComponent };

// ─── Main component ───────────────────────────────────────────────────────────

export default function FraudNetworkGraph() {
  const [nodes, , onNodesChange] = useNodesState<EmployeeNode>(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const emp = node as EmployeeNode;
    const { name, role, fraudType, status } = emp.data;
    if (status === "clean") {
      alert(`✅ ${name}\nRole: ${role}\nStatus: Verified Clean — No fraud detected`);
    } else if (status === "center") {
      alert(`🚨 ${name}\nRole: ${role}\nFraud Type: ${fraudType}\n\nThis employee is the central node of the fraud ring.`);
    } else {
      alert(`⚠️ ${name}\nRole: ${role}\nFraud Type: ${fraudType}`);
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.4}
        maxZoom={2}
        zoomOnScroll={false}
        zoomOnPinch={true}
        panOnScroll={false}
        panOnDrag={true}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: "#0A0F1E" }}
      >
        {/* Dot-grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="rgba(255,255,255,0.07)"
        />

        {/* Minimap — bottom-right */}
        <MiniMap
          bgColor="#0D1426"
          maskColor="rgba(10,15,30,0.75)"
          nodeColor={(node) => {
            const n = node as EmployeeNode;
            if (n.data.status === "center") return "#FF3B5C";
            if (n.data.status === "clean") return "#00C853";
            return "#FF3B5C80";
          }}
          nodeStrokeColor="transparent"
          nodeBorderRadius={50}
          style={{
            background: "#0D1426",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
          }}
          pannable
          zoomable
        />

        {/* Zoom controls — bottom-left */}
        <Controls
          style={{
            background: "#0D1426",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
}
