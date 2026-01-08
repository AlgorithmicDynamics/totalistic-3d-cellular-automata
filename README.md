# Totalistic 3D Cellular Automata

![Preview](images/ca3d_11100010011000_1767834132068.gif)

This project is an interactive environment for exploring **three-dimensional totalistic cellular automata**
defined on a **Von Neumann neighborhood**.

The system is designed as a compact, research-oriented tool for studying emergent behavior,
rule spaces, and structural dynamics in discrete 3D systems.

---

## Live Demo

An interactive, browser-based version of the automaton is available here:

[Demo](https://algorithmicdynamics.com/3d/)

[Mirror](https://algorithmicdynamics.github.io/totalistic-3d-cellular-automata/3d/)

The demo allows real-time rule editing, iteration control, and slice-based visualization
of the evolving 3D field.

---

## Overview

Each cell in the lattice updates its state based on:

- Its **own current state**
- The states of its **six direct neighbors**
  (left, right, up, down, front, back)

The rule depends only on the **total number of active cells** in this local neighborhood,
including the center cell itself.
No directional or positional information is used.

This makes the automaton **totalistic and symmetric by construction**.

---

## Rule Encoding

Instead of defining a full lookup table for all possible neighborhood configurations,
the update rule is **compressed into 14 binary parameters**.

The parameters are interpreted as follows:

- **7 parameters** specify when an **empty cell becomes active**
- **7 parameters** specify when an **active cell remains active**

Each parameter corresponds to a specific total activity level
(number of active cells in the neighborhood, including the center cell).

This encoding dramatically reduces the rule space while preserving a wide range of behaviors,
making it suitable for systematic exploration and experimentation.

---

## Visualization

The automaton evolves in a cubic 3D lattice.
Visualization is performed by rendering a **2D slice** of the volume along the Z axis.

Features include:

- Adjustable lattice size (cubic)
- Real-time iteration
- Z-slice navigation
- Adjustable pixel scale
- Direct rule editing via binary strings and bit controls

The interface is intentionally minimal and instrument-like,
favoring clarity and direct manipulation over abstraction.

---

## Intended Use

This project is intended for:

- Experimental exploration of 3D cellular automata
- Studying stability, extinction, oscillation, and structural formation
- Investigating compressed rule spaces
- Educational and research-oriented visualization

It is not a game and not a simulation of any physical system.
The focus is on **algorithmic structure and emergent dynamics**.

---

## Implementation

- Plain HTML, CSS, and JavaScript
- No external frameworks
- Designed to run directly in the browser
- Suitable for static hosting (e.g. GitHub Pages)

---

## Organization

This repository is part of the **AlgorithmicDynamics** organization,
which focuses on experimental systems, symbolic dynamics,
cellular automata, fractals, and related algorithmic structures.

---

## License
MIT License. See [LICENSE](LICENSE) for details.
