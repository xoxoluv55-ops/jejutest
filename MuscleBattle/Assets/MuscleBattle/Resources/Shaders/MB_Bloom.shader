// Lightweight bloom for the Built-in RP (PC High profile only): soft-knee bright pass,
// progressive box downsample / tent upsample, additive composite. Keeps neon and hit flashes glowing
// without washing out the characters (controlled intensity).
Shader "Hidden/MuscleBattle/Bloom"
{
    Properties { _MainTex ("", 2D) = "white" {} }
    CGINCLUDE
    #include "UnityCG.cginc"
    sampler2D _MainTex, _SourceTex;
    float4 _MainTex_TexelSize;
    half _Threshold, _Knee, _Intensity;

    struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
    v2f vert(appdata_img v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord; return o; }

    half3 Box(float2 uv, float d)
    {
        float4 o = _MainTex_TexelSize.xyxy * float2(-d, d).xxyy;
        return (tex2D(_MainTex, uv + o.xy).rgb + tex2D(_MainTex, uv + o.zy).rgb +
                tex2D(_MainTex, uv + o.xw).rgb + tex2D(_MainTex, uv + o.zw).rgb) * 0.25;
    }

    half3 Prefilter(half3 c)
    {
        half b = max(c.r, max(c.g, c.b));
        half soft = clamp(b - _Threshold + _Knee, 0, 2 * _Knee);
        soft = soft * soft / (4 * _Knee + 1e-4);
        half contrib = max(soft, b - _Threshold) / max(b, 1e-4);
        return c * contrib;
    }
    ENDCG

    SubShader
    {
        Cull Off ZTest Always ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            half4 frag(v2f i) : SV_Target
            {
                return half4(Prefilter(Box(i.uv, 1)), 1);
            }
            ENDCG
        }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            half4 frag(v2f i) : SV_Target
            {
                return half4(Box(i.uv, 1), 1);
            }
            ENDCG
        }
        Pass
        {
            Blend One One
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            half4 frag(v2f i) : SV_Target
            {
                return half4(Box(i.uv, 0.5), 1);
            }
            ENDCG
        }
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            half4 frag(v2f i) : SV_Target
            {
                half4 c = tex2D(_SourceTex, i.uv);
                c.rgb += _Intensity * Box(i.uv, 0.5);
                return c;
            }
            ENDCG
        }
    }
}
