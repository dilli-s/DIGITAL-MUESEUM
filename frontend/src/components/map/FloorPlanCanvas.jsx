import React, { useRef, useEffect } from 'react';

export default function FloorPlanCanvas({ 
    floorPlan, 
    anchors = [], 
    nodes = [], 
    edges = [], 
    artifacts = [], 
    userPosition = null, // { x, y, heading } normalized
    route = [], // array of normalized { map_x, map_y }
    onCanvasClick
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!floorPlan || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Setup canvas size
        canvas.width = floorPlan.width_px || 1000;
        canvas.height = floorPlan.height_px || 1000;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw image (assuming floorPlan.image_url is loaded beforehand, simplified here)
        // const img = new Image(); img.src = floorPlan.image_url; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Helper to convert normalized [0,1] to pixels
        const toPx = (nx, ny) => [nx * canvas.width, ny * canvas.height];

        // Draw Edges
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        edges.forEach(edge => {
            const from = nodes.find(n => n.id === edge.from_node_id);
            const to = nodes.find(n => n.id === edge.to_node_id);
            if (from && to) {
                const [fx, fy] = toPx(from.map_x || from.x_px/canvas.width, from.map_y || from.y_px/canvas.height);
                const [tx, ty] = toPx(to.map_x || to.x_px/canvas.width, to.map_y || to.y_px/canvas.height);
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        });

        // Draw Nodes
        ctx.fillStyle = '#888888';
        nodes.forEach(node => {
            const [x, y] = toPx(node.map_x || node.x_px/canvas.width, node.map_y || node.y_px/canvas.height);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Draw Route Polyline
        if (route && route.length > 0) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            const [sx, sy] = toPx(route[0].map_x, route[0].map_y);
            ctx.moveTo(sx, sy);
            for (let i = 1; i < route.length; i++) {
                const [rx, ry] = toPx(route[i].map_x, route[i].map_y);
                ctx.lineTo(rx, ry);
            }
            ctx.stroke();
        }

        // Draw Anchors
        ctx.fillStyle = '#ef4444';
        anchors.forEach(anc => {
            const [x, y] = toPx(anc.map_x, anc.map_y);
            ctx.fillRect(x - 4, y - 4, 8, 8);
        });

        // Draw Artifacts
        ctx.fillStyle = '#f59e0b';
        artifacts.forEach(art => {
            const [x, y] = toPx(art.map_x, art.map_y);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeRect(x - 5, y - 5, 10, 10);
        });

        // Draw User Marker
        if (userPosition && userPosition.floor_plan_id === floorPlan.id) {
            const [ux, uy] = toPx(userPosition.x, userPosition.y);
            
            // Draw pulse/shadow
            ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.beginPath();
            ctx.arc(ux, uy, 15, 0, 2 * Math.PI);
            ctx.fill();

            // Draw dot
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.arc(ux, uy, 6, 0, 2 * Math.PI);
            ctx.fill();

            // Draw heading indicator
            if (userPosition.heading !== undefined) {
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ux, uy);
                // Heading 0 = North (-Y)
                const rad = (userPosition.heading - 90) * (Math.PI / 180);
                ctx.lineTo(ux + Math.cos(rad) * 20, uy + Math.sin(rad) * 20);
                ctx.stroke();
            }
        }
    }, [floorPlan, anchors, nodes, edges, artifacts, userPosition, route]);

    const handleClick = (e) => {
        if (!onCanvasClick || !floorPlan) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const pxX = e.clientX - rect.left;
        const pxY = e.clientY - rect.top;
        const normX = pxX / rect.width;
        const normY = pxY / rect.height;
        onCanvasClick({ map_x: normX, map_y: normY, x_px: pxX, y_px: pxY });
    };

    return (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            {/* Using a background div to simulate image if not drawn in canvas */}
            <canvas 
                ref={canvasRef} 
                onClick={handleClick}
                style={{
                    width: '100%',
                    height: 'auto',
                    cursor: onCanvasClick ? 'crosshair' : 'default',
                    transition: 'transform 0.3s ease-out'
                }}
            />
        </div>
    );
}
