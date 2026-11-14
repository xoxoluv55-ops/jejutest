#!/usr/bin/env bash
# Prepares reference assemblies for a compile-only check of the NERVE RUNNER Unity scripts
# WITHOUT the Unity editor (used in CI / cloud containers where Unity is not installed).
#   * UnityEngine module reference DLLs: NuGet package "UnityEngine.Modules" 2021.3.33
#   * UnityEngine.UI.dll: built from Unity's public uGUI source (branch 2018.4) with 3 small
#     patches for internal APIs that are not exposed by the reference DLLs.
# Input System / URP types are provided by Stubs.cs (names verified against package sources).
# This catches C# syntax/type/API errors. It is NOT a substitute for opening the project in
# Unity 6000.3 and play-testing.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p refs && cd refs
if [ ! -d mods ]; then
  curl -sSL -o m.nupkg https://api.nuget.org/v3-flatcontainer/unityengine.modules/2021.3.33/unityengine.modules.2021.3.33.nupkg
  unzip -q -o m.nupkg -d mods
fi
if [ ! -f ugui/UnityEngine.UI.dll ]; then
  rm -rf ugui-src && git clone -q --depth 1 -b 2018.4 https://github.com/Unity-Technologies/uGUI.git ugui-src
  U=ugui-src/UnityEngine.UI/UI/Core/Utility
  sed -i 's/UnityEngineInternal.ScriptingUtils.CreateDelegate(\(typeof([A-Za-z0-9]*)\), \([A-Za-z0-9]*\))/System.Delegate.CreateDelegate(\1, \2)/' $U/ReflectionMethodsCache.cs
  sed -i 's/^\(\s*\)CanvasRenderer.AddUIVertexStream(verts, m_Positions.*$/\1\/\/ shim/; s/^\(\s*\)CanvasRenderer.SplitUIVertexStreams(.*$/\1\/\/ shim/; s/^\(\s*\)CanvasRenderer.CreateUIVertexStream(.*$/\1\/\/ shim/' $U/VertexHelper.cs
  mkdir -p ugui-build && cat > ugui-build/ugui.csproj <<'XML'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>netstandard2.1</TargetFramework><LangVersion>9.0</LangVersion><AssemblyName>UnityEngine.UI</AssemblyName>
  <EnableDefaultCompileItems>false</EnableDefaultCompileItems><NoWarn>CS0618;CS0612;CS0414;CS0169;CS0649;CS0067;CS0108;CS0114</NoWarn>
  <DefineConstants>PACKAGE_PHYSICS;PACKAGE_PHYSICS2D;PACKAGE_ANIMATION</DefineConstants></PropertyGroup>
  <ItemGroup><Compile Include="../ugui-src/UnityEngine.UI/**/*.cs" Exclude="../ugui-src/UnityEngine.UI/Properties/**" />
  <Reference Include="../mods/lib/net45/*.dll" /></ItemGroup>
</Project>
XML
  dotnet build ugui-build/ugui.csproj -nologo -v q -o ugui >/dev/null
fi
echo "refs ready: $(pwd)"
