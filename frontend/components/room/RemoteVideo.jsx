'use client';

import {
  VideoOff,
  Mic,
  MicOff
} from "lucide-react";


export default function RemoteVideo({
  stream,
  name,
  audioEnabled = true,
  videoEnabled = true
}) {


return (

<div
className="
group
relative
overflow-hidden
rounded-3xl
border
border-white/10
bg-black
shadow-2xl
transition
hover:border-white/30
"
>


{/* Video */}

<video
autoPlay
playsInline
className="
h-full
w-full
object-cover
"
ref={(video)=>{

if(video){
video.srcObject = stream;
}

}}
/>



{/* Camera OFF overlay */}

{
!videoEnabled && (

<div
className="
absolute
inset-0
flex
flex-col
items-center
justify-center
bg-[#111]
"
>

<div
className="
h-24
w-24
rounded-full
bg-white/10
flex
items-center
justify-center
text-3xl
font-bold
"
>
{name.charAt(name.length-1)}
</div>


<VideoOff
className="
mt-4
text-gray-400
"
/>


</div>

)
}




{/* Bottom gradient */}

<div
className="
absolute
inset-x-0
bottom-0
h-28
bg-gradient-to-t
from-black/90
to-transparent
"
/>




{/* Info */}

<div
className="
absolute
bottom-4
left-4
right-4
flex
items-center
justify-between
"
>


<span
className="
rounded-full
bg-black/50
px-4
py-2
text-sm
backdrop-blur-xl
"
>
{name}
</span>



<div
className="
rounded-full
bg-black/50
p-2
backdrop-blur-xl
"
>

{
audioEnabled
?
<Mic size={16}/>
:
<MicOff
size={16}
className="text-red-400"
/>
}

</div>


</div>


</div>

);

}