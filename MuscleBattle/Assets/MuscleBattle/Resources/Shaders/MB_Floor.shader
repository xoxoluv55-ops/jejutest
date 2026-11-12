// Polished arena floor: base texture + emissive neon pattern (alpha channel) + fake glossy
// sheen that follows the camera (cheap "reflection" that holds up on iPad).
Shader "MuscleBattle/Floor"
{
    Properties
    {
        _MainTex ("Pattern (RGB base, A glow mask)", 2D) = "white" {}
        _BaseColor ("Base", Color) = (0.06,0.07,0.16,1)
        _GlowColor ("Glow", Color) = (0.55,0.3,1,1)
        _GlowColor2 ("Glow 2", Color) = (0.2,0.75,1,1)
        _GlowBoost ("Glow Boost", Float) = 1
        _Sheen ("Sheen", Range(0,2)) = 0.8
        _Pulse ("Impact Pulse", Range(0,3)) = 0
        _ReflectionTex ("Reflection (planar)", 2D) = "black" {}
        _Reflect ("Reflection Strength", Range(0,1)) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            #include "AutoLight.cginc"
            sampler2D _MainTex; float4 _MainTex_ST;
            fixed4 _BaseColor, _GlowColor, _GlowColor2; half _GlowBoost, _Sheen, _Pulse;
            sampler2D _ReflectionTex; half _Reflect;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float3 wp : TEXCOORD1; SHADOW_COORDS(2) UNITY_FOG_COORDS(3) float4 screen : TEXCOORD4; };
            v2f vert(appdata_base v)
            {
                v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.wp = mul(unity_ObjectToWorld, v.vertex).xyz; TRANSFER_SHADOW(o); UNITY_TRANSFER_FOG(o, o.pos);
                o.screen = ComputeScreenPos(o.pos);
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 t = tex2D(_MainTex, i.uv);
                half atten = SHADOW_ATTENUATION(i);
                fixed3 col = _BaseColor.rgb * t.rgb * (0.55 + 0.45 * atten);
                float r = length(i.wp.xz);
                fixed3 glow = lerp(_GlowColor.rgb, _GlowColor2.rgb, saturate(0.5 + 0.5 * sin(r * 0.6 - _Time.y * 0.8)));
                col += glow * t.a * (_GlowBoost + _Pulse * (0.5 + 0.5 * sin(r * 3.0 - _Time.y * 20.0)));
                float3 v = normalize(_WorldSpaceCameraPos - i.wp);
                float3 refl = reflect(-v, float3(0,1,0));
                half sheen = pow(saturate(dot(refl, normalize(float3(0, 0.55, 1)))), 6) * _Sheen;
                col += sheen * fixed3(0.55, 0.5, 0.95) * atten;
                col += ShadeSH9(float4(0,1,0,1)) * 0.15;
                // polished floor: planar reflection of the fighters, slightly rippled by the hex pattern
                float2 suv = i.screen.xy / max(i.screen.w, 1e-4) + (t.a - 0.5) * 0.004;
                fixed3 reflCol = tex2D(_ReflectionTex, suv).rgb;
                col += reflCol * _Reflect;
                UNITY_APPLY_FOG(i.fogCoord, col);
                return fixed4(col, 1);
            }
            ENDCG
        }
    }
    Fallback "Diffuse"
}
