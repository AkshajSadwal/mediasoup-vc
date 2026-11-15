import { useState } from "react";

function Ballot({ poll, action }) {
  const [choices, setChoices] = useState([]);
  const locked = poll.closed || !poll.eligible || (poll.submitted && !poll.change);
  const toggle = (index) => setChoices((previous) => !poll.multiple ? [index] :
    previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index]);
  return <section className="meeting-group">
    <strong>{poll.question}</strong>
    <small>{poll.anonymous ? "Anonymous" : "Named"} · {poll.closed ? "Closed" : poll.deadline ? "Closes at " + new Date(poll.deadline).toLocaleTimeString() : "Open"}</small>
    {!poll.eligible && !poll.closed && <small>Voting is limited to participants present when this opened.</small>}
    {poll.submitted && <small>Your ballot is saved.</small>}
    {poll.options.map((option, index) => <label key={option} className="meeting-inline">
      {!locked && <input type={poll.multiple ? "checkbox" : "radio"} name={poll.id} checked={choices.includes(index)} onChange={() => toggle(index)} />}
      <span>{option}{poll.totals ? " · " + poll.totals[index] : ""}</span>
    </label>)}
    {poll.voters?.map((voter, index) => <small key={index}>{voter.name} · {voter.choices.map((choice) => poll.options[choice]).join(", ")}</small>)}
    <div className="meeting-inline">
      {!locked && <button disabled={!choices.length} onClick={() => action("poll-ballot", { id: poll.id, choices })}>{poll.submitted ? "Update ballot" : "Submit ballot"}</button>}
      {!poll.closed && poll.canClose && <button onClick={() => action("poll-close", { id: poll.id })}>Close voting</button>}
    </div>
  </section>;
}

export default function Polls({ type, live, action, done }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [seconds, setSeconds] = useState(type === "vote" ? 60 : 0);
  const [flags, setFlags] = useState({ multiple: false, anonymous: true, change: false, live: true });
  const submit = async (event) => {
    event.preventDefault();
    if (await action("poll-create", { type, question, options, seconds, ...flags })) done();
  };
  return <div className="meeting-tool">
    {type && (live.features.polls ? <form className="meeting-group" onSubmit={submit}>
      <h3 className="font-semibold">{type === "vote" ? "Create a Yes / No / Abstain vote" : "Create a poll"}</h3>
      <label className="grid">Question<input required maxLength={180} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      {type === "poll" && options.map((option, index) => <label className="grid" key={index}>Option {index + 1}
        <input required maxLength={80} value={option} onChange={(event) => setOptions(options.map((entry, position) => position === index ? event.target.value : entry))} />
      </label>)}
      {type === "poll" && <div className="meeting-inline">
        <button type="button" disabled={options.length >= 8} onClick={() => setOptions([...options, ""])}>Add option</button>
        <button type="button" disabled={options.length <= 2} onClick={() => setOptions(options.slice(0, -1))}>Remove last option</button>
      </div>}
      <label className="grid">Deadline in seconds{type === "poll" ? " (0 for none)" : ""}
        <input type="number" required min={type === "vote" ? 10 : 0} max={3600} value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} />
      </label>
      {Object.entries({ ...(type === "poll" ? { multiple: "Allow multiple choices" } : {}), anonymous: "Anonymous ballots", change: "Allow ballot changes", live: "Show results before close" }).map(([key, label]) =>
        <label key={key} className="meeting-inline"><input type="checkbox" checked={flags[key]} onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })} />{label}</label>)}
      <button>Create {type}</button>
    </form> : <button disabled={live.requested.includes("polls")} onClick={() => action("request", { feature: "polls" })}>{live.requested.includes("polls") ? "Access requested" : "Request poll and vote creation access"}</button>)}
    {live.polls.map((poll) => <Ballot key={poll.id} poll={poll} action={action} />)}
  </div>;
}
