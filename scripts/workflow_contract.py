"""Constrain planned workflow edits while retaining the mandatory CI dependency graph.

PyYAML parses syntax; this deliberately limited contract is not a sandbox for
arbitrary commands in newly added setup steps. Those commands still need review.
"""
from pathlib import Path


class WorkflowContractError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise WorkflowContractError('Contrat workflow : ' + message)


def parse(text):
    try:
        import yaml
    except ImportError as exc:
        raise WorkflowContractError('PyYAML requis pour vérifier la maintenance CI ; exécuter le setup du dépôt') from exc

    class UniqueLoader(yaml.BaseLoader):
        def construct_mapping(self, node, deep=False):
            result = {}
            for key_node, value_node in node.value:
                key = self.construct_object(key_node, deep=deep)
                require(isinstance(key, str) and key not in result, 'clé YAML dupliquée ou non textuelle')
                result[key] = self.construct_object(value_node, deep=deep)
            return result

    try:
        require(not any(isinstance(token, (yaml.tokens.AnchorToken, yaml.tokens.AliasToken, yaml.tokens.TagToken)) for token in yaml.scan(text)), 'ancres, alias et tags YAML non autorisés')
        result = yaml.load(text, Loader=UniqueLoader)
    except yaml.YAMLError as exc:
        raise WorkflowContractError('Contrat workflow : YAML invalide') from exc
    require(isinstance(result, dict), 'document YAML objet attendu')
    return result


def steps(job):
    value = job.get('steps')
    require(isinstance(value, list) and value and all(isinstance(step, dict) for step in value), 'étapes absentes')
    for step in value:
        require(not {'if', 'continue-on-error'}.intersection(step), 'étape conditionnelle ou erreur ignorée interdite')
    return value


def mandatory_step(job, command, env=None):
    matching = [step for step in steps(job) if step.get('run') == command]
    require(len(matching) == 1, 'commande obligatoire absente ou dupliquée : ' + command)
    if env is not None:
        require(matching[0].get('env') == env, 'environnement de commande obligatoire modifié')
    return matching[0]


def canonical(name, value):
    require(value.get('permissions') == {'contents': 'read'}, 'permissions globales obligatoires')
    require(isinstance(value.get('on'), dict) and isinstance(value.get('jobs'), dict), 'déclencheurs ou jobs absents')
    jobs = value['jobs']
    require(all(isinstance(job, dict) for job in jobs.values()), 'définition de job invalide')
    if name == 'product-quality.yml':
        require(set(jobs) == {'scope', 'product'}, 'jobs scope/product obligatoires')
        call = value['on'].get('workflow_call')
        require(isinstance(call, dict) and isinstance(call.get('inputs'), dict) and call['inputs'].get('force_product') == {'type': 'boolean', 'default': 'true'}, 'force_product doit être vrai par défaut')
        scope, product = jobs['scope'], jobs['product']
        require(scope.get('outputs') == {'required': '${{ steps.scope.outputs.required }}', 'gates': '${{ steps.scope.outputs.gates }}'}, 'sorties du sélecteur altérées')
        require(not {'if', 'continue-on-error', 'needs'}.intersection(scope), 'sélecteur de contrôles neutralisé')
        step = mandatory_step(scope, 'python3 scripts/ci_scope.py --event "$CI_EVENT"', {'CI_EVENT': "${{ inputs.force_product && 'workflow_call' || github.event_name }}"})
        require(step.get('id') == 'scope', 'identifiant du sélecteur modifié')
        require(product.get('needs') == 'scope' and product.get('if') == "needs.scope.outputs.required == 'true'", 'dépendance ou condition produit altérée')
        require('continue-on-error' not in product, 'erreurs produit ignorées')
        mandatory_step(product, 'npm ci')
        mandatory_step(product, 'python3 scripts/check_kit.py')
        mandatory_step(product, 'python3 scripts/product_quality.py --gates "$QUALITY_GATES"', {'QUALITY_GATES': '${{ needs.scope.outputs.gates }}'})
    elif name == 'release.yml':
        require(set(jobs) == {'quality', 'deploy'}, 'jobs quality/deploy obligatoires')
        require(value.get('concurrency') == {'group': 'release', 'cancel-in-progress': 'false'}, 'sérialisation des livraisons altérée')
        require(jobs['quality'] == {'if': "github.event_name == 'workflow_dispatch' || vars.AUTO_RELEASE == 'true'", 'uses': './.github/workflows/product-quality.yml', 'with': {'force_product': 'true'}}, 'release doit forcer tous les contrôles')
        deploy = jobs['deploy']
        require(deploy.get('needs') == 'quality' and not {'if', 'continue-on-error'}.intersection(deploy), 'déploiement doit dépendre du succès qualité')
        require(deploy.get('environment') == "${{ inputs.target || 'preproduction' }}", 'environnement de déploiement altéré')
        mandatory_step(deploy, 'python3 scripts/deploy.py', {'DELIVERY_TARGET': "${{ inputs.target || 'preproduction' }}"})
    else:
        raise WorkflowContractError('Workflow hors du contrat de maintenance')


def validate_workflow_edit(path, before, after):
    """Only add setup steps, job env/services and limited deployment OIDC rights."""
    name = Path(path).name
    old, new = parse(before), parse(after)
    canonical(name, old)
    canonical(name, new)
    # Root controls (including event filters and shell defaults) cannot change.
    require({k: v for k, v in old.items() if k not in {'name', 'jobs'}} == {k: v for k, v in new.items() if k not in {'name', 'jobs'}}, 'contrôles globaux modifiés')
    sealed = 'scope' if name == 'product-quality.yml' else 'quality'
    require(old['jobs'][sealed] == new['jobs'][sealed], 'job de contrôle immuable')
    target = 'product' if name == 'product-quality.yml' else 'deploy'
    a, b = old['jobs'][target], new['jobs'][target]
    additions = {'steps', 'env', 'services'} | ({'permissions'} if target == 'deploy' else set())
    require({k: v for k, v in a.items() if k not in additions} == {k: v for k, v in b.items() if k not in additions}, 'structure du job obligatoire modifiée')
    if 'permissions' in b:
        require(target == 'deploy' and b['permissions'] in ({'contents': 'read'}, {'contents': 'read', 'id-token': 'write'}), 'permissions de déploiement non prévues')
    for section in ('env', 'services'):
        require(section not in b or isinstance(b[section], dict), 'configuration ' + section + ' invalide')
        require(all(b.get(section, {}).get(k) == v for k, v in a.get(section, {}).items()), 'configuration existante ' + section + ' modifiée')
    prior = iter(steps(b))
    for step in steps(a):
        require(any(candidate == step for candidate in prior), 'étape existante supprimée, réordonnée ou altérée')
