"use strict";
// Simple test to verify treatment toggling logic
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const TREATMENT_STATE_PATH = (0, node_path_1.join)((0, node_path_1.dirname)("."), "treatment-state.json");
function loadTreatmentState() {
    if (!(0, node_fs_1.existsSync)(TREATMENT_STATE_PATH)) {
        return { nextTreatment: "light" };
    }
    try {
        const raw = (0, node_fs_1.readFileSync)(TREATMENT_STATE_PATH, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { nextTreatment: "light" };
    }
}
function saveTreatmentState(state) {
    (0, node_fs_1.writeFileSync)(TREATMENT_STATE_PATH, JSON.stringify(state, null, 2));
}
// Test the toggling
console.log("Testing treatment toggling for 4 consecutive posts:");
console.log("=====================================================");
for (let i = 1; i <= 4; i++) {
    const state = loadTreatmentState();
    const currentTreatment = state.nextTreatment;
    const opacity = currentTreatment === "light" ? 0.05 : 0.4;
    console.log(`Post ${i}:`);
    console.log(`  Treatment: ${currentTreatment}`);
    console.log(`  Opacity: ${opacity}`);
    console.log(`  Description: ${currentTreatment === "light" ? "Nearly transparent (whitish)" : "Noticeable tint (dark)"}`);
    // Toggle for next time
    const nextState = {
        nextTreatment: currentTreatment === "light" ? "dark" : "light"
    };
    saveTreatmentState(nextState);
    console.log(`  Next treatment will be: ${nextState.nextTreatment}`);
    console.log("");
}
// Show final state
const finalState = loadTreatmentState();
console.log(`Final state in ${TREATMENT_STATE_PATH}: ${JSON.stringify(finalState)}`);
