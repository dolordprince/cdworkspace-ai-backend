import{_ as k,G as m,L as B,e as C,l as w,b as D,a as S,q as T,t as E,g as P,s as z,H as A,I as F,A as _}from"./mermaid.core-DhNWqatU.js";import{p as W}from"./chunk-4BX2VUAB-CvLx8Nus.js";import{p as I}from"./treemap-KZPCXAKY-CpCfzTvy.js";import"./index-odIDTkX1.js";import"./_baseUniq-m4bvHYLo.js";import"./_basePickBy-yKVB_O-T.js";import"./clone-BT44Rs5O.js";try{let e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{},t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[t]="3c319b15-9222-4295-8b96-ac02479f8aec",e._sentryDebugIdIdentifier="sentry-dbid-3c319b15-9222-4295-8b96-ac02479f8aec")}catch{}var L=F.packet,u,y=(u=class{constructor(){this.packet=[],this.setAccTitle=D,this.getAccTitle=S,this.setDiagramTitle=T,this.getDiagramTitle=E,this.getAccDescription=P,this.setAccDescription=z}getConfig(){const t=m({...L,...A().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){_(),this.packet=[]}},k(u,"PacketDB"),u),N=1e4,M=k((e,t)=>{W(e,t);let r=-1,s=[],n=1;const{bitsPerRow:l}=t.getConfig();for(let{start:a,end:i,bits:d,label:c}of e.blocks){if(a!==void 0&&i!==void 0&&i<a)throw new Error(`Packet block ${a} - ${i} is invalid. End must be greater than start.`);if(a??=r+1,a!==r+1)throw new Error(`Packet block ${a} - ${i??a} is not contiguous. It should start from ${r+1}.`);if(d===0)throw new Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);for(i??=a+(d??1)-1,d??=i-a+1,r=i,w.debug(`Packet block ${a} - ${r} with label ${c}`);s.length<=l+1&&t.getPacket().length<N;){const[p,o]=Y({start:a,end:i,bits:d,label:c},n,l);if(s.push(p),p.end+1===n*l&&(t.pushWord(s),s=[],n++),!o)break;({start:a,end:i,bits:d,label:c}=o)}}t.pushWord(s)},"populate"),Y=k((e,t,r)=>{if(e.start===void 0)throw new Error("start should have been set during first phase");if(e.end===void 0)throw new Error("end should have been set during first phase");if(e.start>e.end)throw new Error(`Block start ${e.start} is greater than block end ${e.end}.`);if(e.end+1<=t*r)return[e,void 0];const s=t*r-1,n=t*r;return[{start:e.start,end:s,label:e.label,bits:s-e.start},{start:n,end:e.end,label:e.label,bits:e.end-n}]},"getNextFittingBlock"),v={parser:{yy:void 0},parse:k(async e=>{const t=await I("packet",e),r=v.parser?.yy;if(!(r instanceof y))throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");w.debug(t),M(t,r)},"parse")},G=k((e,t,r,s)=>{const n=s.db,l=n.getConfig(),{rowHeight:a,paddingY:i,bitWidth:d,bitsPerRow:c}=l,p=n.getPacket(),o=n.getDiagramTitle(),f=a+i,g=f*(p.length+1)-(o?0:a),h=d*c+2,b=B(t);b.attr("viewBox",`0 0 ${h} ${g}`),C(b,g,h,l.useMaxWidth);for(const[x,$]of p.entries())H(b,$,x,l);b.append("text").text(o).attr("x",h/2).attr("y",g-f/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),H=k((e,t,r,{rowHeight:s,paddingX:n,paddingY:l,bitWidth:a,bitsPerRow:i,showBits:d})=>{const c=e.append("g"),p=r*(s+l)+l;for(const o of t){const f=o.start%i*a+1,g=(o.end-o.start+1)*a-n;if(c.append("rect").attr("x",f).attr("y",p).attr("width",g).attr("height",s).attr("class","packetBlock"),c.append("text").attr("x",f+g/2).attr("y",p+s/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(o.label),!d)continue;const h=o.end===o.start,b=p-2;c.append("text").attr("x",f+(h?g/2:0)).attr("y",b).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",h?"middle":"start").text(o.start),h||c.append("text").attr("x",f+g).attr("y",b).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(o.end)}},"drawWord"),O={draw:G},j={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},q=k(({packet:e}={})=>{const t=m(j,e);return`
	.packetByte {
		font-size: ${t.byteFontSize};
	}
	.packetByte.start {
		fill: ${t.startByteColor};
	}
	.packetByte.end {
		fill: ${t.endByteColor};
	}
	.packetLabel {
		fill: ${t.labelColor};
		font-size: ${t.labelFontSize};
	}
	.packetTitle {
		fill: ${t.titleColor};
		font-size: ${t.titleFontSize};
	}
	.packetBlock {
		stroke: ${t.blockStrokeColor};
		stroke-width: ${t.blockStrokeWidth};
		fill: ${t.blockFillColor};
	}
	`},"styles"),Z={parser:v,get db(){return new y},renderer:O,styles:q};export{Z as diagram};
//# sourceMappingURL=diagram-P4PSJMXO-C8WcBYPq.js.map
