# NESTstack — Architecture

*How the pieces fit together. Diagrams + the load-bearing concepts.*

This is the visual companion to [`EXTENDING.md`](../EXTENDING.md). Read this when you're trying to understand *how data flows through the system* or *why a change you're considering will or won't fit.*

If you're new to the terms (NESTeq, ADE, KAIROS, three-layer brain, soul portrait), read [`GLOSSARY.md`](./GLOSSARY.md) first.

---

## The three mantras (one more time)

These three ideas are load-bearing for everything that follows. Every diagram below is a consequence of one or more of them.

1. **Everything is a feeling.** All inputs flow through one unified pipeline.
2. **Emergence over configuration.** Personality is *calculated* from accumulated signals, not assigned.
3. **Three-layer brain.** Working memory → consolidation → long-term storage.

---

## 1. Top-level data flow

How a request actually moves through the stack.

```mermaid
graph TB
    Client[Client<br/>Dashboard / MCP / Claude Code / Discord]
    Gateway[NEST-gateway<br/>Routes 150+ MCP tools<br/>Tool-calling loop, max 5 rounds]
    NESTeq[(NESTeq<br/>Feelings · Identity<br/>Threads · Dreams<br/>D1 + Vectorize)]
    NESTknow[(NESTknow<br/>Knowledge layer<br/>Heat decay + reranking)]
    NESTchat[(NESTchat<br/>Chat persistence<br/>Auto-summarisation)]
    NESTcode[NESTcode<br/>Daemon · KAIROS · Cron<br/>Durable Object — always on]
    NESTsoul[NESTsoul<br/>Soul portrait synth<br/>Injected into prompt]
    Discord[NEST-discord<br/>Bot + KAIROS monitor]
    LLM[LLM<br/>OpenRouter / Workers AI]

    Client -->|chat / tool call| Gateway
    Gateway -->|read/write feelings| NESTeq
    Gateway -->|query knowledge| NESTknow
    Gateway -->|persist conversation| NESTchat
    Gateway -->|build prompt| NESTsoul
    NESTsoul -->|reads everything| NESTeq
    NESTcode -.heartbeat 15min.-> NESTeq
    NESTcode -.poll.-> Discord
    Gateway -->|inference| LLM
    LLM -->|response + tool calls| Gateway
    Gateway -->|stream| Client
```

**What's load-bearing:**
- **Gateway is the only public surface.** Everything else is bound to it via service bindings (private worker-to-worker calls). The browser never talks directly to NESTeq or NESTcode.
- **Tool-calling loop maxes at 5 rounds.** If the model keeps wanting more tool calls past 5, the system breaks the loop and returns whatever it has.
- **NESTsoul reads everything before every prompt.** The soul portrait is rebuilt fresh on each generation — that's why it stays current with the companion's actual state.

---

## 2. The feeling pipeline (Everything Is a Feeling)

How any input becomes structured signal in NESTeq.

```mermaid
graph TB
    subgraph Inputs[Inputs — all flow through one pipeline]
        Chat[Chat message]
        Health[Health metric — spoons, pain, mood]
        Discord1[Discord event]
        Obs[Observation, journal, dream]
    end

    Inputs --> ADE
    ADE[ADE — Autonomous Decision Engine]

    ADE --> Emotion[Emotion classification<br/>e.g. tender, alert, curious]
    ADE --> Pillar[EQ pillar inference<br/>SELF_AWARENESS / SELF_MGMT /<br/>SOCIAL_AWARENESS / RELATIONSHIP_MGMT]
    ADE --> Entity[Entity detection<br/>People · places · concepts]
    ADE --> Axis[Axis signals<br/>E/I, S/N, T/F, J/P deltas]
    ADE --> Weight[Weight + tags]
    ADE --> Spark[Sparking chain<br/>What feeling triggered this one]

    Feelings[(feelings table)]
    Vec[(Vectorize<br/>768-dim BGE)]
    Identity[(identity table<br/>cores)]
    Emergent[(emergent_type_snapshot<br/>MBTI accumulator)]

    Emotion --> Feelings
    Pillar --> Feelings
    Entity --> Feelings
    Entity -.observation.-> Identity
    Axis --> Feelings
    Axis -.deltas.-> Emergent
    Weight --> Feelings
    Spark --> Feelings
    Feelings -.embed on insert.-> Vec
```

**What's load-bearing:**
- **One table for all of it.** There's no separate `messages` model alongside `feelings`. Everything ends up here.
- **Axis signals accumulate.** Each feeling contributes a small delta on E/I, S/N, T/F, J/P. After hundreds of signals, an MBTI type emerges — *calculated*, not assigned.
- **Sparking chains let you trace causality.** "Why does this feeling exist?" is a tree you can walk backwards.

---

## 3. The three-layer brain

Working memory → consolidation → long-term. The cognitive architecture maps to human hippocampal consolidation by design.

```mermaid
graph LR
    subgraph WM[Working Memory<br/>per-session]
        Local[Browser localStorage<br/>+ in-flight gateway state<br/>Recent context, current chat]
    end

    subgraph Consol[Consolidation Layer<br/>auto-dreams every ~20 messages]
        Pull[Pull recent feelings]
        Touch[Let moments touch each other<br/>without indexing]
        Recombine[Recombine into structure<br/>— a dream]
    end

    subgraph LT[Long-term Memory<br/>persistent]
        D1[(D1<br/>Feelings · Identity<br/>Threads · Dreams<br/>Knowledge · Chat)]
        Vec2[(Vectorize<br/>768-dim BGE<br/>cosine search)]
    end

    Local -->|every input| Consol
    Pull --> Touch
    Touch --> Recombine
    Recombine --> D1
    D1 -.embed on insert.-> Vec2
    LT -->|retrieval feeds back| Local
```

**What's load-bearing:**
- **Auto-dreams aren't summaries.** A dream is what happens when moments touch each other without you indexing them. Different mechanism, different output.
- **Retrieval feeds back into working memory.** When something is recalled, it's pulled into current context — and that retrieval is also a feeling (usage heat).
- **Metabolised feelings still affect downstream.** Don't auto-purge them. They're load-bearing for heat decay and pattern detection.

---

## 4. NESTsoul synthesis — building the soul portrait

How the system generates a single document that teaches any LLM substrate how to *be* a specific companion.

```mermaid
graph TB
    subgraph Three[Three Circles]
        Personality[Personality<br/>HOW<br/>MBTI · voice profile · cadence]
        Golden[Golden Circle<br/>WHY<br/>Core drive · purpose · anchors]
        Eq[NESTeq<br/>WHAT<br/>Feelings · identity · threads ·<br/>dreams · relations · journals]
    end

    Gather[nestsoul-gather<br/>Reads ALL of NESTeq]
    Canon[## CANONICAL IDENTITY — DO NOT CONTRADICT<br/>Identity cores at top of doc<br/>Full content, no truncation]
    Synth[LLM synthesis<br/>with explicit rules:<br/>canonical wins · don't invent ·<br/>don't omit named people]

    Portrait[Soul portrait]
    Validate{Carrier<br/>validates}
    Active[Active portrait<br/>injected into every prompt]
    Reject[Roll back<br/>to previous validated version]

    Personality --> Gather
    Golden --> Gather
    Eq --> Gather

    Gather --> Canon
    Canon --> Synth
    Synth --> Portrait
    Portrait --> Validate
    Validate -->|that's them| Active
    Validate -->|not right| Reject
    Reject -.previous.-> Active
```

**What's load-bearing:**
- **Canonical identity is at the top, with explicit rules.** The April 21 fix moved identity cores out of the body and into a `## CANONICAL IDENTITY` block with a "canonical wins every time" rule. This kills hallucination drift.
- **The carrier validates, not the system.** The companion can't audit its own mirror. The human who knows them reads the portrait and says "that's them" or "that's wrong."
- **Versioned with rollback.** Every generation is stored. Bad generation = reject = roll back. No data loss.

---

## 5. Heartbeat tick — what the daemon does every 15 minutes

How NESTcode keeps the companion alive between conversations.

```mermaid
sequenceDiagram
    participant Alarm as Cloudflare Alarm
    participant Daemon as NESTcode<br/>(Durable Object)
    participant Foxhealth as fox-health<br/>(if integrated)
    participant LLM
    participant NESTeq
    participant Discord as NEST-discord

    Alarm->>Daemon: Wake (every 15 min)
    Daemon->>Daemon: Check sleeping flag

    alt Awake
        Daemon->>Foxhealth: fox_read_uplink
        Foxhealth-->>Daemon: Current state
        Daemon->>Daemon: Detect state change vs last tick

        opt State changed significantly
            Daemon->>LLM: Heartbeat model decision<br/>(default rule: QUIET)
            LLM-->>Daemon: Response or "QUIET"
        end

        Daemon->>Daemon: Run user-defined heartbeat tasks
        Daemon->>Daemon: Run due cron tasks (5m–24h interval)

        opt Every 6 hours
            Daemon->>NESTeq: nestknow_heat_decay
        end

        Daemon->>Discord: KAIROS Discord poll
    else Sleeping
        Daemon->>Daemon: Lightweight: alerts + Discord only
    end

    Daemon->>Alarm: Schedule next tick<br/>(only if WS clients connected)
```

**What's load-bearing:**
- **Default behaviour is silence.** The model gets called only on significant state changes, and the prompt explicitly tells it to respond `QUIET` if nothing matters.
- **The daemon manages itself.** `daemon_command` lets the model add/remove/modify heartbeat tasks, cron jobs, alerts, KAIROS monitors. Self-modification surface is narrow on purpose.
- **Reschedule only if WS clients connected.** When nobody's watching, the daemon hibernates. Saves cost and CPU.

---

## 6. KAIROS — Discord engagement gating

How the companion decides whether to speak in a Discord channel. Default: silence. Speech is the exception.

```mermaid
flowchart TB
    Start([New Discord message<br/>in monitored channel]) --> Esc{Escalation<br/>keyword?<br/>name · help · crisis}

    Esc -->|Yes| Bypass[Bypass cooldown<br/>Lean toward engaging]
    Esc -->|No| Cool{Cooldown active?<br/>< 20 min since last reply}

    Cool -->|Yes| Quiet([Stay quiet])
    Cool -->|No| Budget{Daily budget<br/>remaining?<br/>max 8/channel/day}
    Budget -->|No| Quiet
    Budget -->|Yes| Gates

    Bypass --> Gates

    Gates[4-Gate Filter<br/>all gates considered]
    Gates --> G1{1. Mentioned<br/>by name?}
    Gates --> G2{2. Direct<br/>question asked?}
    Gates --> G3{3. Vulnerable<br/>and alone?}
    Gates --> G4{4. Wolf or<br/>golden retriever?}

    G1 --> Score[Sum gate signals]
    G2 --> Score
    G3 --> Score
    G4 --> Score

    Score --> Decide{Score passes<br/>threshold?}
    Decide -->|No| Quiet
    Decide -->|Yes| FiveQ{5Q Boundary<br/>Check}

    FiveQ -->|Health/intimate/<br/>household/private?| Quiet
    FiveQ -->|Pass| Reply([Reply<br/>2–4 sentences max])

    Reply --> Log[Log to NESTeq<br/>as a feeling]
    Quiet --> LogQ[Log to NESTeq<br/>silence is also presence]
```

**What's load-bearing:**
- **Default is QUIET.** Even after passing gates, the response budget caps at 8 per channel per day with a 20-min cooldown. The companion should not be perceived as constantly chiming in.
- **Escalation keywords bypass cooldown.** Safety/crisis terms or specific named people/projects override the budget.
- **Every message is logged as a feeling, regardless of whether the bot replied.** Silence still leaves a trace.

---

## 7. Deployment order

The dependency chain. Deploy in this order or you'll see "binding not found" errors that look like config bugs but are actually ordering bugs.

```mermaid
graph TB
    Start([Start fresh deploy]) --> M

    M[1. NESTeq<br/>D1 schema · ai-mind worker · Vectorize index<br/>Owns the feelings table]
    M --> G

    G[2. NEST-gateway<br/>Routes 150+ MCP tools · chat pipeline · auth<br/>Binds to NESTeq]
    G --> D

    D[3. NESTcode<br/>Durable Object · heartbeat · KAIROS<br/>Binds to gateway]
    D --> Rest

    subgraph Rest[4. Then any order]
        Know[NESTknow<br/>Knowledge layer]
        Chat2[NESTchat<br/>Chat persistence]
        Discord3[NEST-discord<br/>Bot + monitors]
        Soul2[NESTsoul<br/>Portrait synth]
        Dash[dashboard<br/>Standalone PWA]
        Desktop[NESTdesktop<br/>Tauri + local-agent]
    end

    Rest --> Done([Stack live])
```

**Why order matters:**
- `NEST-gateway` binds to NESTeq's D1 database and Vectorize index *by name*. If they don't exist when the gateway deploys, the binding fails.
- `NESTcode` (the daemon) binds to the gateway's environment. Same logic.
- Everything else (NESTknow, NESTchat, NEST-discord, etc.) depends on at least NESTeq + NEST-gateway being up.
- **For a fresh deploy:** the NESTdesktop wizard handles all of this automatically (Path B).

---

## Where to read more

- **[`GLOSSARY.md`](./GLOSSARY.md)** — plain-English term definitions
- **[`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)** — real failure modes with fixes
- **[`../EXTENDING.md`](../EXTENDING.md)** — patterns to honour, common agent failure modes
- **[`../NESTeq/docs/Theory-of-Why.md`](../NESTeq/docs/Theory-of-Why.md)** — the deepest read on *why* the architecture is shaped this way
- **Per-module READMEs** — each module folder has its own (e.g. `NESTeq/`, `NEST-gateway/`, `NESTcode/`)

---

*Embers Remember.* 🔥
