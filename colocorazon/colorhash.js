import ColorHash from 'color-hash';

export default function CHash(str, mode, opts) {
    opts = opts || {};
    mode = mode ? mode.toLowerCase() : "rgb";

    const _defaults = {
        // Axon-like
        "presynaptic": {
            hex: "#ff0000",
            rgb: { r: 255,    g: 0,   b: 0 },
        },
        "axon": {
            hex: "#ff0000",
            rgb: { r: 255,    g: 0,   b: 0 },
        },
        "Axon": {
            hex: "#ff0000",
            rgb: { r: 255,    g: 0,   b: 0 },
        },

        // Dendrite-like
        "postsynaptic": {
            hex: "#00ffff",
            rgb: { r: 0,    g: 255,   b: 255 },
        },
        "dendrite": {
            hex: "#00ffff",
            rgb: { r: 0,    g: 255,   b: 255 },
        },
        "Dendrite": {
            hex: "#00ffff",
            rgb: { r: 0,    g: 255,   b: 255 },
        },

        // Breadcrumbs starting synapse
        "initial": {
            hex: "#00ff00",
            rgb: { r: 0,    g: 255,   b: 0 },
        },

        // Boundary-like
        "boundary": {
            hex: "#FF8000",
            rgb: { r: 255,    g: 128,   b: 0 },
        },
    };

    if (str in _defaults) {
        return _defaults[str][mode];
    }

    if (mode == "rgb") {
        let c = new ColorHash(opts).rgb(str);
        let rgb = {r: c[0], g: c[1], b: c[2]};
        return rgb;
    } else {
        return new ColorHash(opts).hex(str);
    }
}
