#!/usr/bin/env node
const http = require('http');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function simulatePDR() {
    console.log("Starting PDR Simulation...");
    
    // Simulate initial scan
    const floorPlanId = 'f0000000-0000-0000-0000-000000000001';
    let currentPos = { x: 0.1, y: 0.9 }; // Near entrance
    let heading = 0; // North (-Y direction visually, so decreasing Y)

    console.log(`Initial position set to: x=${currentPos.x}, y=${currentPos.y}`);
    
    for (let step = 1; step <= 10; step++) {
        await delay(1000); // 1 step per second
        
        // Stride is roughly 0.75m. If map is 100m, step is 0.0075 normalized
        const stepSize = 0.0075; 
        
        // Move north
        currentPos.y -= stepSize;
        
        console.log(`Step ${step}: Moved North. New Position: x=${currentPos.x.toFixed(4)}, y=${currentPos.y.toFixed(4)}`);
    }
    
    console.log("Simulating 90-degree turn right (East)...");
    heading = 90;
    
    for (let step = 11; step <= 20; step++) {
        await delay(1000);
        
        const stepSize = 0.0075; 
        currentPos.x += stepSize;
        
        console.log(`Step ${step}: Moved East. New Position: x=${currentPos.x.toFixed(4)}, y=${currentPos.y.toFixed(4)}`);
    }
    
    console.log("PDR Simulation complete.");
}

simulatePDR().catch(console.error);
