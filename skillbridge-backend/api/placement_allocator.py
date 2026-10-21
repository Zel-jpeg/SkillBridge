"""Deterministic max-cardinality, then max-score capacitated matching.

Successive shortest augmenting paths, with potentials and residual reassignment.
No score cutoff, no slot expansion, and no dependence on input/query order.
Scores are compared to six decimal places; no assessment scores are changed.
"""
from decimal import Decimal, ROUND_HALF_UP
import heapq
import math


def allocate(edges, capacities):
    edges = sorted(edges, key=lambda row: (row['student_id'], row['position_id'], row['id']))
    edges = [row for row in edges if math.isfinite(row['match_score']) and capacities.get(row['position_id'], 0) > 0]
    students = sorted({row['student_id'] for row in edges})
    positions = sorted({row['position_id'] for row in edges})
    student_nodes = {key: i + 1 for i, key in enumerate(students)}
    position_nodes = {key: i + len(students) + 1 for i, key in enumerate(positions)}
    sink = len(students) + len(positions) + 1
    graph = [[] for _ in range(sink + 1)]

    def add(left, right, capacity, cost):
        forward = [right, len(graph[right]), capacity, cost]
        backward = [left, len(graph[left]), 0, -cost]
        graph[left].append(forward)
        graph[right].append(backward)
        return forward

    for student in students:
        add(0, student_nodes[student], 1, 0)
    for position in positions:
        add(position_nodes[position], sink, capacities[position], 0)
    maximum = max((Decimal(str(row['match_score'])) for row in edges), default=Decimal(0))
    references = []
    for row in edges:
        cost = int(((maximum - Decimal(str(row['match_score']))) * 1_000_000).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        references.append((row, add(student_nodes[row['student_id']], position_nodes[row['position_id']], 1, cost)))
    potentials = [0] * len(graph)
    while True:
        distances = [math.inf] * len(graph)
        previous = [None] * len(graph)
        distances[0] = 0
        queue = [(0, 0)]
        while queue:
            distance, node = heapq.heappop(queue)
            if distance != distances[node]:
                continue
            for index, (target, _, capacity, cost) in enumerate(graph[node]):
                candidate = distance + cost + potentials[node] - potentials[target]
                if capacity and candidate < distances[target]:
                    distances[target] = candidate
                    previous[target] = (node, index)
                    heapq.heappush(queue, (candidate, target))
        if previous[sink] is None:
            break
        for node, distance in enumerate(distances):
            if distance != math.inf:
                potentials[node] += distance
        node = sink
        while node:
            parent, index = previous[node]
            edge = graph[parent][index]
            edge[2] -= 1
            graph[node][edge[1]][2] += 1
            node = parent
    return {row['student_id']: row['id'] for row, edge in references if edge[2] == 0}
