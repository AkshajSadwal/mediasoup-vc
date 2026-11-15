import { useEffect, useRef, useState } from "react";
import { imagesFor, prepareBackground } from "./hooks/backgroundImages";

function ImageOption({ image, effects, remove }) {
  const preview = useRef(null);
  useEffect(() => {
    const url = URL.createObjectURL(image.blob);
    const element = preview.current;
    element.src = url;
    return () => {
      element.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [image.blob]);
  return <div className="meeting-inline">
    <img ref={preview} alt="" width="72" height="44" className="rounded object-cover" />
    <button disabled={effects.loading} aria-pressed={effects.id === image.id} onClick={() => effects.choose("image", image)}>{image.name}</button>
    <button disabled={effects.loading} onClick={() => remove(image)}>Delete</button>
  </div>;
}

export default function Backgrounds({ effects, userId }) {
  const [images, setImages] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (userId) imagesFor(userId).then((result) => { if (active) setImages(result); })
      .catch(() => { if (active) setFeedback("This browser could not open custom background storage."); });
    return () => { active = false; };
  }, [userId]);
  const add = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await prepareBackground(file);
      setImages(await imagesFor(userId, "add", { name: file.name.slice(0, 90), blob }));
      setFeedback("");
    } catch (error) { setFeedback(error.message || "The custom background could not be saved."); }
    finally { setBusy(false); }
  };
  const remove = async (image) => {
    try {
      if (effects.id === image.id) await effects.choose("raw");
      setImages(await imagesFor(userId, "delete", image.id));
      setFeedback("");
    } catch (error) { setFeedback(error.message || "Could not delete this image."); }
  };
  return <section className="meeting-tool">
    <div className="meeting-inline">
      <button disabled={effects.loading} aria-pressed={effects.mode === "raw"} onClick={() => effects.choose("raw")}>Raw camera</button>
      <button disabled={effects.loading} aria-pressed={effects.mode === "blur"} onClick={() => effects.choose("blur")}>Blur background</button>
    </div>
    {effects.loading && <p role="status">Loading camera effects…</p>}
    <p>Preview effects on your camera tile. Custom images stay in this browser for your account.</p>
    {images.map((image) => <ImageOption key={image.id} image={image} effects={effects} remove={remove} />)}
    <label className="grid">Add JPEG, PNG or WebP · 10 MB maximum
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !userId || images.length >= 5} onChange={add} />
    </label>
    {images.length >= 5 && <p>Delete a background to add another.</p>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
