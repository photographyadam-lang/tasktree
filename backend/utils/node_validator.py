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

    # Rejections (422 equivalents)
    required_strings = ['title', 'type', 'parent_id', 'summary', 'objective', 'risk', 'size']
    for field in required_strings:
        if not node.get(field):
            raise ValueError(f"Validation Failed: Missing required string field '{field}'")
            
    if str(node.get('type')).lower() not in ['project', 'epic', 'task', 'leaf_task']:
        raise ValueError(f"Validation Failed: Invalid type '{node.get('type')}'")
        
    if str(node.get('risk')).lower() not in ['low', 'medium', 'high']:
        raise ValueError(f"Validation Failed: Invalid risk '{node.get('risk')}'")
        
    if str(node.get('size')).lower() not in ['x-small', 'small', 'medium', 'large', 'x-large']:
        raise ValueError(f"Validation Failed: Invalid size '{node.get('size')}'")
        
    # Leaf task strict validations
    if str(node.get('type')).lower() == 'leaf_task':
        for leaf_list in ['success_criteria', 'tests', 'validation_commands']:
            if not node.get(leaf_list) or not isinstance(node[leaf_list], list) or len(node[leaf_list]) == 0:
                raise ValueError(f"Validation Failed: Leaf tasks must contain at least one {leaf_list}")
                
    return node
