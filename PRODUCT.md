# Product


Source: Aurify take-home brief "Character Swap" (Senior Full Stack Engineer), plus user answers in the init interview on 2026-10-20. The brief overrides two early interview answers ("creators / marketers" as user, "persona consistency" as mechanism). Working folder name is `ai-influencer`; no product brand name is decided.

## Platform

web

## Stack

Next.js (user choice). Deploy on Vercel or another free host (brief requirement). The README must say why this stack and these models were chosen.

## Users

A non-technical person who wants to see themselves inside a specific moment. They choose a template photo of someone doing something (jumping off a pier, laughing at a café table, mid-swing with a tennis racket), upload one or more photos of themselves, and get the same moment back with themselves in it. They use the app on mobile and desktop, with no help.

Secondary audience: the Aurify evaluators. They use the live app as a user would, on the three required cases and on pairs they have not shown, and judge results by eye against the user photo. After submission they hold a 45-minute review of results and decisions with the engineer.

## Product Purpose

Photo character swap. Template photo in, photo out (photo track chosen; the video track is out of scope).

Success means two things hold at once, and they pull against each other:

1. **Identity.** The person in the result is unmistakably the user: their face, age, gender and build. Not a blend with the template's model. The user must recognise their own face.
2. **Action.** Everything else comes from the template: pose, action, objects in the hands, camera angle, framing, light and scene.

Rule when template subject and user differ: the user wins on who they are, the template wins on what is happening. If a case needs a different rule, the README must state the rule and the reason.

## Positioning

Whole-person likeness, not face paste. A face-paste result puts the user's face on the template person's body, and the brief names that as a failure for cases 2 and 3. The result must show the user at their own gender, age and proportions inside the template's pose and scene. The technique that achieves this is an open decision.

## Operating Context

Core flow:

1. Open the app and enter the access code.
2. Upload a template photo.
3. Upload one or more photos of the user.
4. Run the swap and wait (a generation can take minutes).
5. See template, user photo and result side by side.
6. If the result is not right, know what to do next.

Required test cases (cases 2 and 3 run in both directions, so 5 runs minimum):

| # | Template person | User | Good result |
|---|---|---|---|
| 1 | Man | Man | User's face and build doing the template action |
| 2 | Man or woman | The other | User at their own gender doing the action, not user's face on the template body |
| 3 | Adult or child | The other | User at their own age and proportions, not a child body with an adult face or the reverse |

The engineer chooses the test templates and user photos. Pick pairs that stress the approach, not pairs that flatter it. Not every case must be perfect; honest notes on what is wrong are worth more than a polished result that hides it.

## Capabilities and Constraints

Required:

- Template photo upload, one or more user photo uploads, run swap, side-by-side display of template, user photo and result.
- Clear steps, visible progress while waiting, clear errors, and a path forward when the result is wrong.
- Works on mobile and desktop.
- Simple access code gate on the live app so strangers cannot spend API credits.
- Long generations must survive free-tier request time limits (handling approach is part of the task).
- Error handling for failed or slow generations and bad uploads.
- A live app that holds up under evaluator use, including on unseen pairs.

Optional (each must be justified in the README by user benefit): guidance on which photo to upload, a quick fix when the result does not look like the user, choosing between several results, sharing.

Deliverables:

1. Live URL on a free host, behind the access code, up for 7 days after submission.
2. GitHub repository. API keys read from environment variables listed in `.env.example`, never committed.
3. README with: local run steps and deploy method; architecture in a few lines plus one diagram if useful; models used, why, and what was tried and dropped; cost and time per result, measured, not estimated; where the approach fails and why.

Time box: 48 hours from receipt, about 12 to 16 hours of work. Receipt time and submission deadline are not recorded.

Evaluation weight, highest first: likeness and identity; action and scene preservation; UI and UX (optional features judged here); engineering; README honesty.

Open decisions:

- Image models and providers, and the swap technique.
- Job and storage design for long generations.
- Whether the app offers a preset template gallery. The brief's problem statement says users "pick a template"; the build list only requires upload.
- Which optional features to build.
- Product name.
- Submission deadline.

## Evidence on Hand

- Brief: `~/Downloads/Aurify Trial Task for Full Stack Engineer.pdf`. It sits outside the project folder. Decide before committing whether a copy belongs in the public repository.
- No git repository exists yet; the GitHub deliverable needs one.
- No templates, user photos, results, or measured cost and time exist yet. Do not fabricate results, costs, timings or quality claims.

## Product Principles

1. Identity beats polish. A result that looks good but is not the user is a failure.
2. Honest over flattering. Show and document where the swap fails; pick test pairs that stress the approach.
3. The user is the judge of likeness. Give them a fast way to reject a result and try again.
4. Never leave the user guessing. Every step, wait and error says what is happening and what to do next.
5. Each optional feature must earn its place by helping a non-technical user reach a result they recognise.
