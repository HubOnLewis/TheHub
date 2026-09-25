param([string]$ConfigPath = "$PSScriptRoot\config.json")
$ErrorActionPreference = "Stop"
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$api = ([string]$config.apiBaseUrl).TrimEnd('/')
$token = [string]$config.agentToken
$nodeId = [string]$config.nodeId
$ollama = ([string]$config.ollamaBaseUrl).TrimEnd('/')
$model = [string]$config.model
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
function HubApi($method,$path,$body=$null) {
  $args=@{Method=$method;Uri="$api$path";Headers=$headers;TimeoutSec=30}
  if($null -ne $body){$args.Body=($body|ConvertTo-Json -Depth 20)}
  Invoke-RestMethod @args
}
function ModelList {
  try { @((Invoke-RestMethod "$ollama/api/tags" -TimeoutSec 8).models.name) } catch { @() }
}
function Heartbeat($jobId=$null,$successId=$null,$err=$null) {
  $models=ModelList
  HubApi POST "/agent-worker/heartbeat" @{nodeId=$nodeId;currentJobId=$jobId;lastSuccessfulJobId=$successId;lastError=$err;runtime=@{agentRuntime="hub-pc-v1";ollamaOk=($models.Count -gt 0);models=$models}} | Out-Null
}
function BuildPrompt($job) {
  $facts=$job.input|ConvertTo-Json -Depth 15
  "You are a HuB on Lewis venue CRM intelligence agent. Task: $($job.taskType). Use only supplied CRM facts. Never invent pricing, dates, availability, payments, or actions. Give concise operational analysis and next actions. Any outbound message is a draft requiring human approval. Facts: $facts"
}
function RunJob($job) {
  HubApi POST "/agent-worker/jobs/$($job.id)/claim" @{nodeId=$nodeId}|Out-Null
  Heartbeat $job.id
  $start=Get-Date
  try {
    $body=@{model=$model;prompt=(BuildPrompt $job);stream=$false;format="json";options=@{temperature=0.2}}
    $r=Invoke-RestMethod -Method POST -Uri "$ollama/api/generate" -ContentType "application/json" -Body ($body|ConvertTo-Json -Depth 10) -TimeoutSec 180
    $result=$r.response
    try {$result=$r.response|ConvertFrom-Json} catch {}
    HubApi POST "/agent-worker/jobs/$($job.id)/complete" @{nodeId=$nodeId;result=$result;runtimeMetadata=@{nodeId=$nodeId;model=$model;durationMs=[int]((Get-Date)-$start).TotalMilliseconds;agentRuntime="hub-pc-v1";ollamaOk=$true}}|Out-Null
    Heartbeat $null $job.id
  } catch {
    $msg=$_.Exception.Message
    try {HubApi POST "/agent-worker/jobs/$($job.id)/fail" @{nodeId=$nodeId;error=$msg;runtimeMetadata=@{nodeId=$nodeId;model=$model;agentRuntime="hub-pc-v1";ollamaOk=$false}}|Out-Null}catch{}
    Heartbeat $null $null $msg
  }
}
while($true){
  try { Heartbeat } catch {}
  try {$job=HubApi GET "/agent-worker/jobs/next?nodeId=$nodeId";if($job){RunJob $job}} catch {}
  Start-Sleep -Seconds 10
}
