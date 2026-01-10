# Totalistic 3D Cellular Automata

![Preview](images/ca3d_11100010011000_1767834132068.gif)

This repository contains a collection of **interactive, browser-based implementations of three-dimensional totalistic cellular automata**, developed as part of the **AlgorithmicDynamics** project.

The focus is on **rule-space exploration**, **emergent structure**, and **visual analysis** of discrete dynamical systems in 3D.

➡ **Source repository:**  
[github.com/AlgorithmicDynamics/totalistic-3d-cellular-automata](https://github.com/AlgorithmicDynamics/totalistic-3d-cellular-automata)

All implementations run entirely in the browser and are available via **GitHub Pages** and **algorithmicdynamics.com**.

---

## Live Systems

### 1. Von Neumann Neighborhood (7-cell, totalistic)

A minimal 3D totalistic automaton based on the **Von Neumann neighborhood**
(center cell + 6 axis-aligned neighbors).

- **Rule size:** 14 bits  
  - 7 conditions for empty → alive  
  - 7 conditions for alive → alive
- **Neighborhood:** center + faces
- **Rule space:** strongly compressed, symmetric

**Live demo**
- [algorithmicdynamics.com/von-neumann](https://algorithmicdynamics.com/von-neumann/)
- [GitHub Pages mirror](https://algorithmicdynamics.github.io/totalistic-3d-cellular-automata/von-neumann/)

---

### 2. Reduced Moore Neighborhood (19-cell, totalistic)

An extended neighborhood including **faces and edges**, but excluding corners
(center + 18 neighbors).

This variant significantly increases structural richness while remaining
fully totalistic and isotropic.

- **Rule size:** 38 bits  
  - 19 conditions for empty → alive  
  - 19 conditions for alive → alive
- **Neighborhood:** center + faces + edges
- **Rule space:** large but still tractable

**Live demo**
- [algorithmicdynamics.com/reduced-moore](https://algorithmicdynamics.com/reduced-moore/)
- [GitHub Pages mirror](https://algorithmicdynamics.github.io/totalistic-3d-cellular-automata/reduced-moore/)

---

### 3. Genetic Algorithm Explorer (19-cell, interactive evolution)

A **manual genetic algorithm** layered on top of the 19-cell totalistic automaton.

Instead of editing rules directly, the user **selects visually interesting behaviors**,
which are then evolved through selection, crossover, and mutation.

- **Genome:** 38-bit totalistic rule
- **Population:** persistent via local storage
- **Fitness:** user-driven (visual selection)
- **Purpose:** discovery of unexpected or complex dynamics

**Live demo**
- [algorithmicdynamics.com/genetic_algorithm](http://algorithmicdynamics.com/genetic_algorithm/)
- [GitHub Pages mirror](https://algorithmicdynamics.github.io/totalistic-3d-cellular-automata/genetic_algorithm/)

---

## Core Concepts

All systems in this repository share the following principles:

- Three-dimensional cubic lattice
- Binary cell states (alive / empty)
- Synchronous updates
- Totalistic rules  
  (depend only on the number of active cells, not their arrangement)
- Toroidal boundary conditions
- 2D Z-slice visualization for inspection of 3D structure

The goal is not physical simulation, but **algorithmic exploration of emergent form**.

---

## Visualization Model

Because full 3D rendering is intentionally avoided, all systems expose:

- Adjustable lattice size
- Adjustable pixel scale
- Real-time iteration
- Interactive Z-slice navigation
- Direct rule manipulation (or evolutionary selection)

This keeps the tools **fast**, **inspectable**, and suitable for **static hosting**.

---

## Intended Use

This repository is intended for:

- Exploration of 3D cellular automata behavior
- Study of compressed rule spaces
- Investigation of stability, extinction, oscillation, and structure formation
- Educational and research-oriented experimentation

It is **not a game** and **not a physical model**.

---

## Implementation

- Plain HTML, CSS, and JavaScript
- No external libraries
- Runs fully in the browser
- Designed for GitHub Pages and static hosting

Each subdirectory is a **self-contained system**.

---

## About AlgorithmicDynamics

**AlgorithmicDynamics** is an open research initiative focused on:

- Cellular automata
- Symbolic dynamics
- Fractals
- Genetic and evolutionary systems
- Algorithmic structure and emergence

---

## License

MIT License. See [LICENSE](LICENSE) for details.
