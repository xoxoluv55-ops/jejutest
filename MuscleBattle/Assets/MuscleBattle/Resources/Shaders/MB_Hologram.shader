// Anatomy hologram: fresnel edge + scrolling scan lines + flicker. Used for muscle overlays,
// background anatomy displays and the energy shell on specials.
Shader "MuscleBattle/Hologram"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color", Color) = (0.3,0.8,1,1)
        _Alpha ("Alpha", Range(0,2)) = 1
        _Fresnel ("Fresnel Power", Range(0.2,6)) = 1.6
        _LineDensity ("Scan Line Density", Float) = 60
        _ScrollSpeed ("Scroll Speed", Float) = 1.2
        _Flicker ("Flicker", Range(0,1)) = 0.1
    }
    SubShader
    {
        Tags { "Queue"="Transparent+10" "IgnoreProjector"="True" "RenderType"="Transparent" }
        Blend SrcAlpha One
        ZWrite Off
        Cull Back
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; float4 _MainTex_ST;
            fixed4 _Color; half _Alpha, _Fresnel, _LineDensity, _ScrollSpeed, _Flicker;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float3 n : TEXCOORD1; float3 wp : TEXCOORD2; };
            v2f vert(appdata_base v)
            {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.n = UnityObjectToWorldNormal(v.normal); o.wp = mul(unity_ObjectToWorld, v.vertex).xyz; return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                float3 vdir = normalize(_WorldSpaceCameraPos - i.wp);
                half fres = pow(1.0 - saturate(abs(dot(normalize(i.n), vdir))), _Fresnel);
                half lines = 0.55 + 0.45 * sin((i.wp.y * _LineDensity) - _Time.y * _ScrollSpeed * 6.0);
                half flick = 1.0 - _Flicker * step(0.93, frac(sin(floor(_Time.y * 24.0)) * 43758.5453));
                fixed4 tex = tex2D(_MainTex, i.uv);
                fixed4 c = _Color * tex;
                c.a = saturate((0.35 + fres * 1.2) * lines * flick * _Alpha * tex.a);
                c.rgb *= 1.0 + fres;
                return c;
            }
            ENDCG
        }
    }
}
