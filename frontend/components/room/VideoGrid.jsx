'use client';

import LocalVideo from "./LocalVideo";
import RemoteVideo from "./RemoteVideo";

export default function VideoGrid({
  remoteStreams,
  localVideoRef,
  audioEnabled,
  videoEnabled,
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
bg-[#111]
shadow-2xl
flex
items-center
justify-center
"
>

<p className="
text-xl
text-gray-500
font-medium
">
Waiting for participants...
</p>

</div>

) : (

<div
className="
grid
h-full
gap-6
md:grid-cols-2
xl:grid-cols-3
"
>

{
  remoteStreams.map((item,index)=>(

    <RemoteVideo
      key={item.producerId}
      stream={item.stream}
      name={`Remote User ${index + 1}`}
      audioEnabled={item.audioEnabled}
      videoEnabled={item.videoEnabled}
    />

  ))
}

</div>

)

}


{/* ALWAYS SAME LOCAL VIDEO */}

<LocalVideo
 localVideoRef={localVideoRef}
 audioEnabled={audioEnabled}
 videoEnabled={videoEnabled}
/>


</section>

);

}