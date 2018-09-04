import ColorHash from 'color-hash';

export default function CHash(str, opts) {
    opts = opts || {};

    const _defaults = {
        // Axon-like
        "presynaptic": "#ff0000",
        "axon": "#ff0000",
        "Axon": "#ff0000",

        // Dendrite-like
        "postsynaptic": "#00ffff",
        "dendrite": "#00ffff",
        "Dendrite": "#00ffff",

        // Breadcrumbs starting synapse
        "initial": "#00ff00",

        // Boundary-like
        "boundary": "#FA7407",
    };

    if (str in _defaults) {
        return _defaults[str];
    }
    return new ColorHash(opts).hex(str);
}
