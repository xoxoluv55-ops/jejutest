// MUSCLE BATTLE stylized character / prop shader (Built-in render pipeline).
// Two-tone ramp + coloured rim light + emission + hit flash. Cheap enough for iPad WebGL.
Shader "MuscleBattle/Toon"
{
    Properties
    {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _ShadeColor ("Shade Tint", Color) = (0.55,0.5,0.75,1)
        _RimColor ("Rim Color", Color) = (0.4,0.8,1,1)
        _RimPower ("Rim Power", Range(0.5,8)) = 3
        _Gloss ("Gloss", Range(0,1)) = 0.25
        _Emission ("Emission", Color) = (0,0,0,0)
        _FlashColor ("Flash Color", Color) = (1,1,1,1)
        _Flash ("Flash", Range(0,1)) = 0
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
            fixed4 _Color, _ShadeColor, _RimColor, _Emission, _FlashColor;
            half _RimPower, _Gloss, _Flash;
            // stage lighting rig (set globally by StageManager): cool fill light + coloured back rim
            float4 _MB_FillDir; fixed4 _MB_FillColor;
            float4 _MB_RimDir; fixed4 _MB_RimLight;

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 normal : TEXCOORD1;
                float3 worldPos : TEXCOORD2;
                SHADOW_COORDS(3)
                UNITY_FOG_COORDS(4)
            };

            v2f vert (appdata_base v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.normal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                TRANSFER_SHADOW(o);
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 n = normalize(i.normal);
                float3 l = normalize(_WorldSpaceLightPos0.xyz);
                float3 v = normalize(_WorldSpaceCameraPos - i.worldPos);
                fixed4 albedo = tex2D(_MainTex, i.uv) * _Color;

                half atten = SHADOW_ATTENUATION(i);
                half ndl = dot(n, l);
                half ramp = smoothstep(-0.05, 0.12, ndl) * lerp(0.35, 1.0, atten);
                fixed3 lit = albedo.rgb * _LightColor0.rgb;
                fixed3 shade = albedo.rgb * _ShadeColor.rgb * 0.75;
                fixed3 col = lerp(shade, lit, ramp);
                col += albedo.rgb * ShadeSH9(float4(n, 1)) * 0.45;
                // fill light (no shadows) lifts the dark side so faces/bodies stay readable
                col += albedo.rgb * _MB_FillColor.rgb * saturate(dot(n, normalize(_MB_FillDir.xyz + 1e-4)));

                float3 h = normalize(l + v);
                half spec = pow(saturate(dot(n, h)), 48) * _Gloss * ramp;
                col += spec * _LightColor0.rgb;

                half rim = pow(1.0 - saturate(dot(n, v)), _RimPower);
                col += _RimColor.rgb * rim * _RimColor.a;
                // back rim light: bright edge on the side facing the stage back light (separates fighters from the background)
                half back = saturate(dot(n, normalize(_MB_RimDir.xyz + 1e-4)));
                col += _MB_RimLight.rgb * pow(1.0 - saturate(dot(n, v)), 2.0) * back * 1.4;
                col += _Emission.rgb;
                col = lerp(col, _FlashColor.rgb, _Flash);
                UNITY_APPLY_FOG(i.fogCoord, col);
                return fixed4(col, 1);
            }
            ENDCG
        }
        // shadow caster
        Pass
        {
            Tags { "LightMode"="ShadowCaster" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_shadowcaster
            #include "UnityCG.cginc"
            struct v2f { V2F_SHADOW_CASTER; };
            v2f vert(appdata_base v) { v2f o; TRANSFER_SHADOW_CASTER_NORMALOFFSET(o) return o; }
            float4 frag(v2f i) : SV_Target { SHADOW_CASTER_FRAGMENT(i) }
            ENDCG
        }
    }
    Fallback "Diffuse"
}
