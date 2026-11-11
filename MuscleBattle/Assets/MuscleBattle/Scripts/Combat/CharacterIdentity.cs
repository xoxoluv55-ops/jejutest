using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Who this fighter is (data only). Lives on FighterRoot next to FighterController so logic,
    /// identity and the swappable visual (FighterRig: PrototypeVisual / VisualRoot) stay separate.
    ///
    /// FighterRoot
    ///   FighterController   (state machine, health, meter, hit/hurt handling via CombatManager)
    ///   CharacterIdentity   (definition, side)
    ///   Rig_{id}            (FighterRig: pose driver)
    ///     PrototypeVisual   (primitive body - test only, hidden when a model exists)
    ///     VisualRoot        (Humanoid character model)
    /// </summary>
    public sealed class CharacterIdentity : MonoBehaviour
    {
        public FighterDefinition Definition { get; private set; }
        public int Side { get; private set; }
        public string DisplayName => Definition?.NameEn;

        public void Set(FighterDefinition def, int side)
        {
            Definition = def;
            Side = side;
            gameObject.name = (side == 0 ? "P1_" : "P2_") + def.Id;
        }
    }
}
