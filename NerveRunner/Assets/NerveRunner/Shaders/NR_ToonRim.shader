// NERVE RUNNER - cartoon body shader for STAR-01 and hero props (URP, opaque).
// Two-tone ramp from the main light + ambient probe + soft toon highlight + fresnel rim glow
// + emission. No textures, no shadows (STAR-01 uses a cheap blob shadow) -> mobile friendly.
// If this shader is missing/unsupported, NRMats falls back to URP/Lit materials.
Shader "NerveRunner/ToonRim"
{
    Properties
    {
        _BaseColor ("Base (lit side)", Color) = (1, 0.83, 0.3, 1)
        _ShadeColor ("Shade (dark side)", Color) = (0.95, 0.55, 0.2, 1)
        _RimColor ("Rim glow", Color) = (1, 0.95, 0.7, 1)
        _RimPower ("Rim power", Float) = 2.5
        _HighlightColor ("Highlight", Color) = (1, 1, 1, 1)
        _Gloss ("Highlight size", Float) = 60
        _EmissionColor ("Emission", Color) = (0, 0, 0, 1)
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "Queue" = "Geometry" "RenderPipeline" = "UniversalPipeline" }

        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            half4 _ShadeColor;
            half4 _RimColor;
            half _RimPower;
            half4 _HighlightColor;
            half _Gloss;
            half4 _EmissionColor;
        CBUFFER_END
        ENDHLSL

        Pass
        {
            Name "ToonForward"
            Tags { "LightMode" = "UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                half fogFactor : TEXCOORD2;
            };

            Varyings vert (Attributes v)
            {
                Varyings o;
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                VertexNormalInputs n = GetVertexNormalInputs(v.normalOS);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                o.normalWS = n.normalWS;
                o.fogFactor = ComputeFogFactor(p.positionCS.z);
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                float3 v = normalize(GetWorldSpaceViewDir(i.positionWS));
                Light l = GetMainLight();
                half ndl = dot(n, l.direction) * 0.5h + 0.5h;
                half ramp = smoothstep(0.38h, 0.62h, ndl);
                half3 col = lerp(_ShadeColor.rgb, _BaseColor.rgb, ramp);
                col += SampleSH(n) * _BaseColor.rgb * 0.25h;
                float3 h = normalize(l.direction + v);
                half spec = pow(saturate(dot(n, h)), _Gloss);
                col += smoothstep(0.45h, 0.55h, spec) * _HighlightColor.rgb * 0.55h;
                half rim = pow(1.0h - saturate(dot(n, v)), _RimPower);
                col += rim * _RimColor.rgb;
                col += _EmissionColor.rgb;
                col = MixFog(col, i.fogFactor);
                return half4(col, 1.0h);
            }
            ENDHLSL
        }

        Pass
        {
            Name "DepthOnly"
            Tags { "LightMode" = "DepthOnly" }
            ZWrite On
            ColorMask R
            HLSLPROGRAM
            #pragma vertex dvert
            #pragma fragment dfrag
            float4 dvert (float4 positionOS : POSITION) : SV_POSITION { return TransformObjectToHClip(positionOS.xyz); }
            half dfrag () : SV_Target { return 0; }
            ENDHLSL
        }

        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode" = "DepthNormals" }
            ZWrite On
            HLSLPROGRAM
            #pragma vertex nvert
            #pragma fragment nfrag
            struct NA { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct NV { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; };
            NV nvert (NA v) { NV o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.normalWS = TransformObjectToWorldNormal(v.normalOS); return o; }
            half4 nfrag (NV i) : SV_Target { return half4(normalize(i.normalWS), 0.0h); }
            ENDHLSL
        }
    }
    FallBack Off
}
