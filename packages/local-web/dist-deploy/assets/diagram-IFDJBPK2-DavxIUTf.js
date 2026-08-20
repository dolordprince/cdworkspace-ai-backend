import{_ as l,s as O,g as _,t as k,q as D,a as R,b as E,L as F,A as G,G as $,H as b,I as z,l as P,a1 as W,e as B}from"./mermaid.core-DhNWqatU.js";import{p as H}from"./chunk-4BX2VUAB-CvLx8Nus.js";import{p as V}from"./treemap-KZPCXAKY-CpCfzTvy.js";import"./index-odIDTkX1.js";import"./_baseUniq-m4bvHYLo.js";import"./_basePickBy-yKVB_O-T.js";import"./clone-BT44Rs5O.js";try{let e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{},t=new e.Error().stack;t&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[t]="4577e8ca-473a-43a8-a62d-3a272b72f261",e._sentryDebugIdIdentifier="sentry-dbid-4577e8ca-473a-43a8-a62d-3a272b72f261")}catch{}var h={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},w={axes:[],curves:[],options:h},m=structuredClone(w),j=z.radar,q=l(()=>$({...j,...b().radar}),"getConfig"),C=l(()=>m.axes,"getAxes"),N=l(()=>m.curves,"getCurves"),U=l(()=>m.options,"getOptions"),X=l(e=>{m.axes=e.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),Y=l(e=>{m.curves=e.map(t=>({name:t.name,label:t.label??t.name,entries:Z(t.entries)}))},"setCurves"),Z=l(e=>{if(e[0].axis==null)return e.map(a=>a.value);const t=C();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(a=>{const r=e.find(s=>s.axis?.$refText===a.name);if(r===void 0)throw new Error("Missing entry for axis "+a.label);return r.value})},"computeCurveEntries"),J=l(e=>{const t=e.reduce((a,r)=>(a[r.name]=r,a),{});m.options={showLegend:t.showLegend?.value??h.showLegend,ticks:t.ticks?.value??h.ticks,max:t.max?.value??h.max,min:t.min?.value??h.min,graticule:t.graticule?.value??h.graticule}},"setOptions"),K=l(()=>{G(),m=structuredClone(w)},"clear"),f={getAxes:C,getCurves:N,getOptions:U,setAxes:X,setCurves:Y,setOptions:J,getConfig:q,clear:K,setAccTitle:E,getAccTitle:R,setDiagramTitle:D,getDiagramTitle:k,getAccDescription:_,setAccDescription:O},Q=l(e=>{H(e,f);const{axes:t,curves:a,options:r}=e;f.setAxes(t),f.setCurves(a),f.setOptions(r)},"populate"),tt={parse:l(async e=>{const t=await V("radar",e);P.debug(t),Q(t)},"parse")},et=l((e,t,a,r)=>{const s=r.db,o=s.getAxes(),i=s.getCurves(),n=s.getOptions(),c=s.getConfig(),d=s.getDiagramTitle(),p=F(t),u=at(p,c),g=n.max??Math.max(...i.map(y=>Math.max(...y.entries))),x=n.min,v=Math.min(c.width,c.height)/2;rt(u,o,v,n.ticks,n.graticule),st(u,o,v,c),M(u,o,i,x,g,n.graticule,c),T(u,i,n.showLegend,c),u.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),at=l((e,t)=>{const a=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,s={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return B(e,r,a,t.useMaxWidth??!0),e.attr("viewBox",`0 0 ${a} ${r}`),e.append("g").attr("transform",`translate(${s.x}, ${s.y})`)},"drawFrame"),rt=l((e,t,a,r,s)=>{if(s==="circle")for(let o=0;o<r;o++){const i=a*(o+1)/r;e.append("circle").attr("r",i).attr("class","radarGraticule")}else if(s==="polygon"){const o=t.length;for(let i=0;i<r;i++){const n=a*(i+1)/r,c=t.map((d,p)=>{const u=2*p*Math.PI/o-Math.PI/2,g=n*Math.cos(u),x=n*Math.sin(u);return`${g},${x}`}).join(" ");e.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),st=l((e,t,a,r)=>{const s=t.length;for(let o=0;o<s;o++){const i=t[o].label,n=2*o*Math.PI/s-Math.PI/2;e.append("line").attr("x1",0).attr("y1",0).attr("x2",a*r.axisScaleFactor*Math.cos(n)).attr("y2",a*r.axisScaleFactor*Math.sin(n)).attr("class","radarAxisLine"),e.append("text").text(i).attr("x",a*r.axisLabelFactor*Math.cos(n)).attr("y",a*r.axisLabelFactor*Math.sin(n)).attr("class","radarAxisLabel")}},"drawAxes");function M(e,t,a,r,s,o,i){const n=t.length,c=Math.min(i.width,i.height)/2;a.forEach((d,p)=>{if(d.entries.length!==n)return;const u=d.entries.map((g,x)=>{const v=2*Math.PI*x/n-Math.PI/2,y=A(g,r,s,c),I=y*Math.cos(v),S=y*Math.sin(v);return{x:I,y:S}});o==="circle"?e.append("path").attr("d",L(u,i.curveTension)).attr("class",`radarCurve-${p}`):o==="polygon"&&e.append("polygon").attr("points",u.map(g=>`${g.x},${g.y}`).join(" ")).attr("class",`radarCurve-${p}`)})}l(M,"drawCurves");function A(e,t,a,r){const s=Math.min(Math.max(e,t),a);return r*(s-t)/(a-t)}l(A,"relativeRadius");function L(e,t){const a=e.length;let r=`M${e[0].x},${e[0].y}`;for(let s=0;s<a;s++){const o=e[(s-1+a)%a],i=e[s],n=e[(s+1)%a],c=e[(s+2)%a],d={x:i.x+(n.x-o.x)*t,y:i.y+(n.y-o.y)*t},p={x:n.x-(c.x-i.x)*t,y:n.y-(c.y-i.y)*t};r+=` C${d.x},${d.y} ${p.x},${p.y} ${n.x},${n.y}`}return`${r} Z`}l(L,"closedRoundCurve");function T(e,t,a,r){if(!a)return;const s=(r.width/2+r.marginRight)*3/4,o=-(r.height/2+r.marginTop)*3/4,i=20;t.forEach((n,c)=>{const d=e.append("g").attr("transform",`translate(${s}, ${o+c*i})`);d.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),d.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(n.label)})}l(T,"drawLegend");var nt={draw:et},ot=l((e,t)=>{let a="";for(let r=0;r<e.THEME_COLOR_LIMIT;r++){const s=e[`cScale${r}`];a+=`
		.radarCurve-${r} {
			color: ${s};
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
		}
		`}return a},"genIndexStyles"),it=l(e=>{const t=W(),a=b(),r=$(t,a.themeVariables),s=$(r.radar,e);return{themeVariables:r,radarOptions:s}},"buildRadarStyleOptions"),lt=l(({radar:e}={})=>{const{themeVariables:t,radarOptions:a}=it(e);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${a.axisColor};
		stroke-width: ${a.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${a.axisLabelFontSize}px;
		color: ${a.axisColor};
	}
	.radarGraticule {
		fill: ${a.graticuleColor};
		fill-opacity: ${a.graticuleOpacity};
		stroke: ${a.graticuleColor};
		stroke-width: ${a.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${a.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${ot(t,a)}
	`},"styles"),xt={parser:tt,db:f,renderer:nt,styles:lt};export{xt as diagram};
//# sourceMappingURL=diagram-IFDJBPK2-DavxIUTf.js.map
