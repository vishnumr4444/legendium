/**
 * ============================================
 * REVERSE PATH POINTS MODULE
 * ============================================
 * Utility function to reverse direction of path curves.
 * Used for NPCs that walk back and forth on the same path.
 * 
 * Functionality:
 * - Reverses vertex order in path splines
 * - Maintains path structure while inverting direction
 * - Essential for bidirectional path following
 * 
 * Usage:
 * Called by pathFollower when reversePoints flag is true
 */

export function reversePathPoints(jsonData){
    return jsonData.map((curve) => {
        return {
          ...curve,
          vertices: curve.vertices.map((spline) => spline.reverse()), // Reverse points in each spline
        };
      });
}