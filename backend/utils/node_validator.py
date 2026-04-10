import uuid
from typing import Dict, Any, List
from datetime import datetime, timezone

def validate_and_repair_node(node: Dict[str, Any]) -> Dict[str, Any]:
    """Execute §11.6 Response Validation Contract"""
    
    # Repair Rule 1: Missing ID
    if not node.get('id'):
        node['id'] = str(uuid.uuid4())
        
    # Repair Rule 2: Timestamps
    current_time = datetime.now(timezone.utc).isoformat()
    if not node.get('created_at'):
        node['created_at'] = current_time
    if not node.get('updated_at'):
        node['updated_at'] = current_time
        
    # Repair Rule 3: Decomposed
    if 'last_decomposed_at' not in node:
        node['last_decomposed_at'] = None
        
    # Repair Rule 4: Array bounds
    for array_field in ['scope', 'out_of_scope', 'prerequisites', 'depends_on']:
        if array_field not in node or node[array_field] is None:
            node[array_field] = []
            
    # Repair Rule 5: Notes
    if node.get('notes') is None:
        node['notes'] = ""

    # Repair Rule 6: Soft string fields — default to empty string if missing rather than hard-rejecting.
    # LLMs frequently omit 'objective' and 'summary' when the context is implied. These are repairable.
    for soft_field in ['objective', 'summary']:
        if not node.get(soft_field):
            node[soft_field] = ""

    # Hard Rejections (422) — truly structural fields where an empty value makes the node unusable
    hard_required = ['title', 'type', 'parent_id']
    for field in hard_required:
        if not node.get(field):
            raise ValueError(f"Validation Failed: Missing required string field '{field}'")

    # Repair Rule 7: Normalize risk — default invalid/None values to 'low'
    valid_risks = ['low', 'medium', 'high']
    raw_risk = str(node.get('risk', '')).lower().strip()
    if raw_risk not in valid_risks:
        node['risk'] = 'low'
    else:
        node['risk'] = raw_risk

    # Repair Rule 8: Normalize size — default invalid/None values to 'medium'
    valid_sizes = ['x-small', 'small', 'medium', 'large', 'x-large']
    raw_size = str(node.get('size', '')).lower().strip()
    if raw_size not in valid_sizes:
        node['size'] = 'medium'
    else:
        node['size'] = raw_size
            
    if str(node.get('type')).lower() not in ['project', 'epic', 'task', 'leaf_task']:
        raise ValueError(f"Validation Failed: Invalid type '{node.get('type')}'")
        
    # Leaf task strict validations (Repair Rule 9)
    if str(node.get('type')).lower() == 'leaf_task':
        for leaf_list in ['success_criteria', 'tests', 'validation_commands']:
            if not node.get(leaf_list) or not isinstance(node[leaf_list], list) or len(node[leaf_list]) == 0:
                node[leaf_list] = [f"Pending {leaf_list.replace('_', ' ')}"]

    return node
