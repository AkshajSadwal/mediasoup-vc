'use client';

import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";

export default function VideoGrid({
  remoteStreams,
  localVideoRef,
  audioEnabled,
  videoEnabled,
  participants = [],
  localName = "You",
  localIsAdmin = false,
  localAvatarUrl = null,
}) {

return (

<section
className="
relative
flex-1
min-h-0
p-6
"
>


{
remoteStreams.length === 0 ? (

<div
className="
h-full
rounded-3xl
bg-[#eaf2fc]
shadow-2xl
flex
items-center
justify-center
"
>

<p className="
text-xl
text-[#718096]
font-medium
">
Waiting for participants...
</p>

</div>

) : (

<div
className="
grid
fullh-
gap-6
md:grid-cols-2
xl:grid-cols-3
"
>

{
  remoteStreams.map((item, index) => {
    const participant = participants.find((entry) => entry.peerId === item.peerId);

    return (
      <RemoteVideo
        key={item.peerId}
        stream={item.stream}
        trackSignature={item.trackSignature}
        name={participant?.name || participant?.username || `Remote User ${index + 1}`}
        audioEnabled={item.audioEnabled}
        videoEnabled={item.videoEnabled}
        isAdmin={Boolean(participant?.isAdmin)}
        avatarUrl={participant?.avatarUrl ? `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}${participant.avatarUrl}` : null}
      />
    );
  })
}

</div>

)

}


{/* ALWAYS SAME LOCAL VIDEO */}

<LocalVideo
 localVideoRef={localVideoRef}
 audioEnabled={audioEnabled}
 videoEnabled={videoEnabled}
 name={localName}
 isAdmin={localIsAdmin}
 avatarUrl={localAvatarUrl}
/>


</section>

);

}