
import { parseResponse } from "./src/api.js";

const qwenOutput = `### What Went Wrong
<think>
Some thinking...
</think>
Why This Happens
Because of this...

How to Fix It
Do this...`;
  
console.log(parseResponse(qwenOutput));

