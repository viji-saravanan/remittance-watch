# ADR-0007 · Ranking policy: publish costs verbatim, flag what they mean

- Status: accepted · Date: 2026-08-24 · Deciders: viji-saravanan

## Context

The explorer's one job is ranking providers by **true total cost**. Two classes of rows make
that ranking lie if handled carelessly — both documented in
[data-provenance.md](../data-provenance.md), which explicitly deferred the decision to M2:

1. **Negative FX margins / negative total cost.** 18,298 quotes dataset-wide (67 in the
   latest quarter's transparent $200 tier — KWT→PAK, CAN→GHA, ARE→PAK, ZAF→MWI, …) have a
   negative margin because the provider's real rate beats the WB's official reference rate —
   typically corridors into officially-overvalued currencies. A further 275 latest-quarter
   quotes have a negative margin but positive total (the fee outweighs the rate advantage).
   Ranked naively, a negative-total quote reads as *"you are paid to send money"* — true
   relative to the official rate, wildly misleading relative to the counter.
2. **Non-transparent rows** (6,722 quotes, 2016_2Q–2021_4Q) publish a total but store their
   FX margin as a literal `0` that their own notes call a lie.

## Options

| Option | For | Against |
|---|---|---|
| **Rank verbatim + flag** | The published number is the published number; nothing hidden, nothing distorted; the flag carries the explanation | Top of some rankings shows a counter-intuitive negative |
| Exclude negatives from ranking | Cleaner top-of-list | Hides the genuinely cheapest *published* deals; editorializes against the data we exist to surface |
| Floor negatives at 0% | No scary minus signs | Misstates the figure and manufactures artificial ties; sort order no longer matches the numbers shown |

## Decision

- **Rank by `total_cost_pct` verbatim, ascending.** No clamping, no exclusion. Ties break
  deterministically: total ASC, then provider name ASC, then instrument ASC.
- **Flag, don't hide.** Any quote with `fx_margin_pct < 0` carries a visible
  **"rate advantage"** badge; any quote with `total_cost_pct < 0` additionally shows the
  negative total and one line of explanation: *the provider's FX rate beats the World Bank's
  reference rate, so cost measured against the official rate is below zero — the printed fee
  is still positive.* The explorer page carries a methodology note saying this in full.
- **Non-transparent quotes are never ranked.** They appear in a separate flagged list
  ("fee disclosed, margin not disclosed") exactly as the landing promises — consistent since
  ADR-0002.
- **Amounts are the two tiers RPW actually publishes: $200 and $500.** The amount control is
  a real two-tier switch, not a free numeric input — we do not interpolate costs the
  workbook never surveyed. Default $200 (the SDG 10.c benchmark).
- **Decomposition shown = fee% + margin% = total%**, computed from the published columns
  (`fee_lcu / lcu_amount`, `fx_margin_pct`), the same identity the ingest guardrail checks.

## Consequences

- The ranked list can open with a negative number in rate-distorted corridors — accepted,
  because the badge + note turn the confusion into the product's most interesting insight.
- Ranking is pure presentation of stored columns: no ranking-specific normalization exists
  anywhere in the pipeline, so the artifact stays a faithful projection of the dataset.
- If the WB ever revises its reference-rate methodology, our numbers change only by
  re-running the pipeline — no site-side policy to unwind.
