import { mastra } from "./src/mastra";

async function testWorkflow() {
  console.log("🧪 Starting workflow test...");
  
  const workflow = mastra.getWorkflow("weeklyMarketResearch");
  
  if (!workflow) {
    console.error("❌ Workflow not found");
    return;
  }
  
  console.log("✅ Workflow found, creating run...");
  
  const run = await workflow.createRunAsync();
  
  console.log("🚀 Starting workflow execution...");
  console.log("📝 This will take several minutes due to rate limiting (25s delays between searches)...");
  
  try {
    const result = await run.start({
      inputData: {}
    });
    
    console.log("✅ Workflow completed!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Workflow failed:", error);
  }
}

testWorkflow();
